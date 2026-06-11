package annotationsapi

import (
	"context"
	"errors"
	"fmt"
	"strconv"

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

const labelKeyLegacyID = "grafana.app/legacyID"

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

// ProvideProxyHandler is the Wire provider.
func ProvideProxyHandler(cfg *setting.Cfg, userSvc user.Service) (*ProxyHandler, error) {
	k8sClient, err := NewClient(cfg, userSvc)
	if err != nil {
		return nil, err
	}
	return &ProxyHandler{
		client: k8sClient,
		phase:  cfg.AnnotationAppPlatform.APIMigrationPhase,
	}, nil
}

// Enabled reports whether the proxy is active.
func (h *ProxyHandler) Enabled() bool {
	return h.client != nil && (h.phase == "proxy-writes" || h.phase == "proxy-all")
}

// Create sends the annotation to the k8s API server and returns the assigned legacy ID.
func (h *ProxyHandler) Create(ctx context.Context, orgID int64, item *annotations.Item) (int64, error) {
	obj := itemToObject(item)
	result, err := h.client.Create(ctx, obj, orgID, v1.CreateOptions{})
	if err != nil {
		return 0, err
	}
	return legacyIDFromObject(result), nil
}

// Update replaces the k8s annotation identified by annotationID. Returns ErrNotFound
// if the annotation is not in the k8s store (caller should fall back to legacy).
func (h *ProxyHandler) Update(ctx context.Context, orgID int64, annotationID int64, item *annotations.Item) error {
	existing, err := h.findByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return err
	}
	obj := itemToObject(item)
	obj.SetName(existing.GetName())
	obj.SetResourceVersion(existing.GetResourceVersion())
	_, err = h.client.Update(ctx, obj, orgID, v1.UpdateOptions{})
	return err
}

// Delete removes the k8s annotation identified by annotationID. Returns ErrNotFound
// if the annotation is not in the k8s store (caller should fall back to legacy).
func (h *ProxyHandler) Delete(ctx context.Context, orgID int64, annotationID int64) error {
	existing, err := h.findByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return err
	}
	return h.client.Delete(ctx, existing.GetName(), orgID, v1.DeleteOptions{})
}

// FindByLegacyID returns the k8s annotation object with the given legacy numeric ID.
// Returns ErrNotFound when absent.
func (h *ProxyHandler) FindByLegacyID(ctx context.Context, orgID int64, annotationID int64) (*unstructured.Unstructured, error) {
	return h.findByLegacyID(ctx, orgID, annotationID)
}

func (h *ProxyHandler) findByLegacyID(ctx context.Context, orgID int64, annotationID int64) (*unstructured.Unstructured, error) {
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

// itemToObject converts a legacy annotations.Item to a k8s unstructured object.
// The Data field is not stored in the k8s annotation spec.
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

// legacyIDFromObject reads the grafana.app/legacyID label. Returns 0 if absent.
func legacyIDFromObject(obj *unstructured.Unstructured) int64 {
	labels := obj.GetLabels()
	if labels == nil {
		return 0
	}
	id, _ := strconv.ParseInt(labels[labelKeyLegacyID], 10, 64)
	return id
}

// TODO: soft-delete not yet implemented
func (h *ProxyHandler) Get(ctx context.Context, orgID int64, annotationID int64) (*annotations.ItemDTO, error) {
	obj, err := h.findByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return nil, err
	}

	dto := objectToItemDTO(obj)

	createdBy := obj.GetAnnotations()["grafana.com/createdBy"]
	if createdBy != "" {
		if users, err := h.client.GetUsersFromMeta(ctx, []string{createdBy}); err == nil {
			if u, ok := users[createdBy]; ok {
				dto.UserID = u.ID
				dto.UserUID = u.UID
				dto.Login = u.Login
				dto.Email = u.Email
			}
		}
	}

	return dto, nil
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

// SpecFromObject extracts spec fields from a k8s unstructured annotation.
// JSON numbers are float64 after unmarshaling, so we convert explicitly.
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
