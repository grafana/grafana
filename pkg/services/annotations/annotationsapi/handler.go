package annotationsapi

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// ErrNotFound is returned by proxy methods when the annotation is not in the new storage
var ErrNotFound = errors.New("annotation not found in new store")

// ProxyHandler carries the k8s client for the standalone annotation API server.
//
// When enabled (api_migration_phase = proxy-writes or proxy-all):
//   - Creates go to the new store only; the legacy DB is not written.
//   - Updates and deletes try the new store first. ErrNotFound means the record
//     predates the migration and has not been backfilled yet — the caller falls
//     back to the legacy DB for those.
//
// client is nil when api_migration_phase is "off", keeping all behaviour unchanged.
type ProxyHandler struct {
	client client.K8sHandler
	phase  string
}

func ProvideProxyHandler(cfg *setting.Cfg, userSvc user.Service) (*ProxyHandler, error) {
	phase := cfg.AnnotationAppPlatform.APIMigrationPhase
	if phase != "off" && strings.TrimSpace(cfg.AnnotationAppPlatform.APIServerURL) == "" {
		return nil, fmt.Errorf("annotation proxy: api_server_url must be set when api_migration_phase is %q", phase)
	}

	k8sClient, err := NewClient(cfg, userSvc)
	if err != nil {
		return nil, err
	}
	return &ProxyHandler{
		client: k8sClient,
		phase:  phase,
	}, nil
}

func (h *ProxyHandler) Enabled() bool {
	return h.client != nil && (h.phase == "proxy-writes" || h.phase == "proxy-all")
}

func (h *ProxyHandler) ProxyAll() bool {
	return h.client != nil && h.phase == "proxy-all"
}

// List fetches annotations from the new store matching query and returns them as ItemDTOs.
// Tags are not supported as k8s field selectors — callers must filter by tags after this call.
func (h *ProxyHandler) List(ctx context.Context, orgID int64, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	listOpts := v1.ListOptions{Limit: query.Limit}
	if fs := buildFieldSelector(query); fs != "" {
		listOpts.FieldSelector = fs
	}

	list, err := h.client.List(ctx, orgID, listOpts)
	if err != nil {
		return nil, err
	}

	// Collect unique createdBy values for batch user hydration.
	seen := make(map[string]bool)
	var createdByMeta []string
	for _, obj := range list.Items {
		if cb := obj.GetAnnotations()["grafana.com/createdBy"]; cb != "" && !seen[cb] {
			createdByMeta = append(createdByMeta, cb)
			seen[cb] = true
		}
	}
	userMap := map[string]*user.User{}
	if len(createdByMeta) > 0 {
		userMap, _ = h.client.GetUsersFromMeta(ctx, createdByMeta)
	}

	dtos := make([]*annotations.ItemDTO, 0, len(list.Items))
	for i := range list.Items {
		obj := &list.Items[i]
		dto := objectToItemDTO(obj)
		if cb := obj.GetAnnotations()["grafana.com/createdBy"]; cb != "" {
			if u, ok := userMap[cb]; ok {
				applyUserToDTO(u, dto)
			}
		}
		dtos = append(dtos, dto)
	}
	return dtos, nil
}

// buildFieldSelector converts supported query fields to a k8s field selector string.
// Tags, alertId, type, and userId have no field selector support and are omitted.
func buildFieldSelector(q *annotations.ItemQuery) string {
	var parts []string
	if q.DashboardUID != "" {
		parts = append(parts, "spec.dashboardUID="+q.DashboardUID)
	}
	if q.PanelID != 0 {
		parts = append(parts, fmt.Sprintf("spec.panelID=%d", q.PanelID))
	}
	if q.From != 0 {
		parts = append(parts, fmt.Sprintf("spec.time=%d", q.From))
	}
	if q.To != 0 {
		parts = append(parts, fmt.Sprintf("spec.timeEnd=%d", q.To))
	}
	return strings.Join(parts, ",")
}

// Merge combines new-store and legacy items, deduplicates by legacyID (new store wins),
// sorts by time descending, and applies limit.
func Merge(newItems, legacyItems []*annotations.ItemDTO, limit int64) []*annotations.ItemDTO {
	inNew := make(map[int64]bool, len(newItems))
	for _, item := range newItems {
		inNew[item.ID] = true
	}

	merged := make([]*annotations.ItemDTO, 0, len(newItems)+len(legacyItems))
	merged = append(merged, newItems...)
	for _, item := range legacyItems {
		if !inNew[item.ID] {
			merged = append(merged, item)
		}
	}

	sort.Slice(merged, func(i, j int) bool {
		if merged[i].TimeEnd != merged[j].TimeEnd {
			return merged[i].TimeEnd > merged[j].TimeEnd
		}
		return merged[i].Time > merged[j].Time
	})

	if limit > 0 && int64(len(merged)) > limit {
		merged = merged[:limit]
	}
	return merged
}

// FilterByTags removes items that do not match the tag query.
// matchAny=true: item must have at least one of the tags.
// matchAny=false: item must have all of the tags.
func FilterByTags(items []*annotations.ItemDTO, tags []string, matchAny bool) []*annotations.ItemDTO {
	if len(tags) == 0 {
		return items
	}
	result := items[:0]
	for _, item := range items {
		if matchAny {
			if hasAnyTag(item.Tags, tags) {
				result = append(result, item)
			}
		} else {
			if hasAllTags(item.Tags, tags) {
				result = append(result, item)
			}
		}
	}
	return result
}

func hasAnyTag(itemTags, queryTags []string) bool {
	set := make(map[string]bool, len(itemTags))
	for _, t := range itemTags {
		set[t] = true
	}
	for _, t := range queryTags {
		if set[t] {
			return true
		}
	}
	return false
}

func hasAllTags(itemTags, queryTags []string) bool {
	set := make(map[string]bool, len(itemTags))
	for _, t := range itemTags {
		set[t] = true
	}
	for _, t := range queryTags {
		if !set[t] {
			return false
		}
	}
	return true
}

// Create writes to new store and returns the assigned legacy ID.
func (h *ProxyHandler) Create(ctx context.Context, orgID int64, item *annotations.Item) (int64, error) {
	obj := itemToObject(item)
	result, err := h.client.Create(ctx, obj, orgID, v1.CreateOptions{})
	if err != nil {
		return 0, err
	}
	return legacyIDFromObject(result), nil
}

// Update writes to new store. Returns ErrNotFound if the record is not there yet, caller falls back to legacy.
func (h *ProxyHandler) Update(ctx context.Context, orgID int64, annotationID int64, item *annotations.Item) error {
	existing, err := h.FindByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return err
	}
	obj := itemToObject(item)
	obj.SetName(existing.GetName())
	obj.SetResourceVersion(existing.GetResourceVersion())
	_, err = h.client.Update(ctx, obj, orgID, v1.UpdateOptions{})
	return err
}

// Delete removes from new store. Returns ErrNotFound if the record is not there yet — caller falls back to legacy.
func (h *ProxyHandler) Delete(ctx context.Context, orgID int64, annotationID int64) error {
	existing, err := h.FindByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return err
	}
	return h.client.Delete(ctx, existing.GetName(), orgID, v1.DeleteOptions{})
}

// FindByLegacyID returns ErrNotFound when absent.
func (h *ProxyHandler) FindByLegacyID(ctx context.Context, orgID int64, annotationID int64) (*unstructured.Unstructured, error) {
	list, err := h.client.List(ctx, orgID, v1.ListOptions{
		FieldSelector: fmt.Sprintf("metadata.legacyID=%d", annotationID),
	})
	if err != nil {
		return nil, err
	}
	if len(list.Items) == 0 {
		return nil, ErrNotFound
	}
	return &list.Items[0], nil
}

// TODO: soft-delete not yet implemented
func (h *ProxyHandler) Get(ctx context.Context, orgID int64, annotationID int64) (*annotations.ItemDTO, error) {
	obj, err := h.FindByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return nil, err
	}

	dto := objectToItemDTO(obj)

	createdBy := obj.GetAnnotations()["grafana.com/createdBy"]
	if createdBy != "" {
		if users, err := h.client.GetUsersFromMeta(ctx, []string{createdBy}); err == nil {
			if u, ok := users[createdBy]; ok {
				applyUserToDTO(u, dto)
			}
		}
	}

	return dto, nil
}

func applyUserToDTO(u *user.User, dto *annotations.ItemDTO) {
	dto.UserID = u.ID
	dto.UserUID = u.UID
	dto.Login = u.Login
	dto.Email = u.Email
}

func objectToItemDTO(obj *unstructured.Unstructured) *annotations.ItemDTO {
	spec, _ := obj.Object["spec"].(map[string]any)

	dto := &annotations.ItemDTO{ID: legacyIDFromObject(obj)}
	dto.Text, _ = spec["text"].(string)
	if t, ok := spec["time"].(float64); ok {
		dto.Time = int64(t)
	}
	if te, ok := spec["timeEnd"].(float64); ok {
		dto.TimeEnd = int64(te)
	}
	if uid, ok := spec["dashboardUID"].(string); ok {
		dto.DashboardUID = &uid
	}
	if pid, ok := spec["panelID"].(float64); ok {
		dto.PanelID = int64(pid)
	}
	if rawTags, ok := spec["tags"].([]any); ok {
		for _, rt := range rawTags {
			if s, ok := rt.(string); ok {
				dto.Tags = append(dto.Tags, s)
			}
		}
	}
	if ts := obj.GetCreationTimestamp(); !ts.IsZero() {
		dto.Created = ts.UnixMilli()
	}
	return dto
}

func itemToObject(item *annotations.Item) *unstructured.Unstructured {
	spec := map[string]any{
		"text": item.Text,
		"time": item.Epoch,
	}
	if item.EpochEnd != 0 {
		spec["timeEnd"] = item.EpochEnd
	}
	if item.DashboardUID != "" {
		spec["dashboardUID"] = item.DashboardUID
	}
	if item.PanelID != 0 {
		spec["panelID"] = item.PanelID
	}
	if len(item.Tags) > 0 {
		tags := make([]any, len(item.Tags))
		for i, t := range item.Tags {
			tags[i] = t
		}
		spec["tags"] = tags
	}

	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": annotationV0.GroupVersion.String(),
		"kind":       "Annotation",
		"metadata":   map[string]any{},
		"spec":       spec,
	}}
	if item.UserID != 0 {
		obj.SetAnnotations(map[string]string{
			"grafana.com/createdBy": fmt.Sprintf("user:%d", item.UserID),
		})
	}
	return obj
}

func legacyIDFromObject(obj *unstructured.Unstructured) int64 {
	labels := obj.GetLabels()
	if labels == nil {
		return 0
	}
	id, _ := strconv.ParseInt(labels["grafana.app/legacyID"], 10, 64)
	return id
}

// JSON numbers unmarshal as float64, so we cast to int64 explicitly.
func SpecFromObject(obj *unstructured.Unstructured) (epoch, epochEnd int64, text string, tags []string) {
	spec, _ := obj.Object["spec"].(map[string]any)
	text, _ = spec["text"].(string)
	if t, ok := spec["time"].(float64); ok {
		epoch = int64(t)
	}
	if te, ok := spec["timeEnd"].(float64); ok {
		epochEnd = int64(te)
	}
	if rawTags, ok := spec["tags"].([]any); ok {
		for _, rt := range rawTags {
			if s, ok := rt.(string); ok {
				tags = append(tags, s)
			}
		}
	}
	return
}
