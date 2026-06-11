package annotationsapi

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// ErrNotFound is returned by proxy methods when the annotation is not in the new storage
var ErrNotFound = errors.New("annotation not found in new store")

// MigrationProxy routes annotation writes to the new API server.
// When phase is "off" or api_server_url is empty, all methods are no-ops and callers fall back to legacy.
type MigrationProxy struct {
	client *annotationAPIClient
	phase  string
}

func ProvideMigrationProxy(cfg *setting.Cfg, userSvc user.Service) (*MigrationProxy, error) {
	phase := cfg.AnnotationAppPlatform.APIMigrationPhase
	if phase != "off" && strings.TrimSpace(cfg.AnnotationAppPlatform.APIServerURL) == "" {
		return nil, fmt.Errorf("annotation proxy: api_server_url must be set when api_migration_phase is %q", phase)
	}

	k8sClient, err := newClient(cfg, userSvc)
	if err != nil {
		return nil, err
	}

	var c *annotationAPIClient
	if k8sClient != nil {
		c = &annotationAPIClient{k8sClient: k8sClient}
	}

	return &MigrationProxy{
		client: c,
		phase:  phase,
	}, nil
}

func (h *MigrationProxy) Enabled() bool {
	return h.client != nil && (h.phase == "proxy-writes" || h.phase == "proxy-all")
}

func (h *MigrationProxy) ProxyAll() bool {
	return h.client != nil && h.phase == "proxy-all"
}

// List fetches annotations from the new store matching query and returns them as ItemDTOs.
// Tags are not supported as k8s field selectors — callers must filter by tags after this call.
func (h *MigrationProxy) List(ctx context.Context, orgID int64, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	listOpts := v1.ListOptions{Limit: query.Limit}
	if fs := buildFieldSelector(query); fs != "" {
		listOpts.FieldSelector = fs
	}

	annos, err := h.client.List(ctx, orgID, listOpts)
	if err != nil {
		return nil, err
	}

	// Collect unique createdBy values for batch user hydration.
	seen := make(map[string]bool)
	var createdByMeta []string
	for _, anno := range annos {
		if cb := anno.GetAnnotations()["grafana.com/createdBy"]; cb != "" && !seen[cb] {
			createdByMeta = append(createdByMeta, cb)
			seen[cb] = true
		}
	}
	userMap := map[string]*user.User{}
	if len(createdByMeta) > 0 {
		userMap, _ = h.client.GetUsersFromMeta(ctx, createdByMeta)
	}

	dtos := make([]*annotations.ItemDTO, 0, len(annos))
	for _, anno := range annos {
		dto := annoToItemDTO(anno)
		if cb := anno.GetAnnotations()["grafana.com/createdBy"]; cb != "" {
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
func (h *MigrationProxy) Create(ctx context.Context, orgID int64, item *annotations.Item) (int64, error) {
	result, err := h.client.Create(ctx, orgID, itemToAnnotation(item))
	if err != nil {
		return 0, err
	}
	return legacyIDFromAnnotation(result), nil
}

// Update writes to new store. Returns ErrNotFound if the record is not there yet, caller falls back to legacy.
func (h *MigrationProxy) Update(ctx context.Context, orgID int64, annotationID int64, item *annotations.Item) error {
	existing, err := h.client.GetByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return err
	}
	anno := itemToAnnotation(item)
	anno.SetName(existing.GetName())
	anno.SetResourceVersion(existing.GetResourceVersion())
	_, err = h.client.Update(ctx, orgID, anno)
	return err
}

// Delete removes from new store. Returns ErrNotFound if the record is not there yet — caller falls back to legacy.
func (h *MigrationProxy) Delete(ctx context.Context, orgID int64, annotationID int64) error {
	existing, err := h.client.GetByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return err
	}
	return h.client.Delete(ctx, orgID, existing.GetName())
}

// TODO: soft-delete not yet implemented
func (h *MigrationProxy) Get(ctx context.Context, orgID int64, annotationID int64) (*annotations.ItemDTO, error) {
	anno, err := h.client.GetByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return nil, err
	}

	dto := annoToItemDTO(anno)

	createdBy := anno.GetAnnotations()["grafana.com/createdBy"]
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

func annoToItemDTO(anno *annotationV0.Annotation) *annotations.ItemDTO {
	dto := &annotations.ItemDTO{
		ID:           legacyIDFromAnnotation(anno),
		Text:         anno.Spec.Text,
		Time:         anno.Spec.Time,
		Tags:         anno.Spec.Tags,
		DashboardUID: anno.Spec.DashboardUID,
	}
	if anno.Spec.TimeEnd != nil {
		dto.TimeEnd = *anno.Spec.TimeEnd
	}
	if anno.Spec.PanelID != nil {
		dto.PanelID = *anno.Spec.PanelID
	}
	if ts := anno.GetCreationTimestamp(); !ts.IsZero() {
		dto.Created = ts.UnixMilli()
	}
	return dto
}

func itemToAnnotation(item *annotations.Item) *annotationV0.Annotation {
	spec := annotationV0.AnnotationSpec{
		Text: item.Text,
		Time: item.Epoch,
		Tags: item.Tags,
	}
	if item.EpochEnd != 0 {
		spec.TimeEnd = &item.EpochEnd
	}
	if item.DashboardUID != "" {
		spec.DashboardUID = &item.DashboardUID
	}
	if item.PanelID != 0 {
		spec.PanelID = &item.PanelID
	}

	anno := &annotationV0.Annotation{Spec: spec}
	anno.APIVersion = annotationV0.GroupVersion.String()
	anno.Kind = "Annotation"
	if item.UserID != 0 {
		anno.SetAnnotations(map[string]string{
			"grafana.com/createdBy": fmt.Sprintf("user:%d", item.UserID),
		})
	}
	return anno
}

func legacyIDFromAnnotation(anno *annotationV0.Annotation) int64 {
	labels := anno.GetLabels()
	if labels == nil {
		return 0
	}
	id, _ := strconv.ParseInt(labels["grafana.app/legacyID"], 10, 64)
	return id
}

// NewK8sHandler is used only in tests to inject a fake K8sHandler directly.
func NewK8sHandler(h client.K8sHandler) *MigrationProxy {
	return &MigrationProxy{
		client: &annotationAPIClient{k8sClient: h},
		phase:  "proxy-writes",
	}
}
