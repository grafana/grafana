package annotationsapi

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	annotationpkg "github.com/grafana/grafana/pkg/registry/apps/annotation"
	"github.com/grafana/grafana/pkg/services/annotations"
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
	logger log.Logger
}

func ProvideMigrationProxy(cfg *setting.Cfg, userSvc user.Service) (*MigrationProxy, error) {
	phase := cfg.AnnotationAppPlatform.APIMigrationPhase
	switch phase {
	case "off", "proxy-writes", "proxy-all":
	default:
		return nil, fmt.Errorf("annotation proxy: unknown api_migration_phase %q: must be one of off, proxy-writes, proxy-all", phase)
	}

	if phase != "off" && strings.TrimSpace(cfg.AnnotationAppPlatform.APIServerURL) == "" {
		return nil, fmt.Errorf("annotation proxy: api_server_url must be set when api_migration_phase is %q", phase)
	}

	c, err := newAnnotationAPIClient(cfg, userSvc)
	if err != nil {
		return nil, err
	}

	return &MigrationProxy{
		client: c,
		phase:  phase,
		logger: log.New("annotationsapi"),
	}, nil
}

func (h *MigrationProxy) Enabled() bool {
	return h.client != nil && (h.phase == "proxy-writes" || h.phase == "proxy-all")
}

func (h *MigrationProxy) ProxyAll() bool {
	return h.client != nil && h.phase == "proxy-all"
}

// List fetches annotations from the new store matching query and returns them as ItemDTOs.
// All filtering including tags is handled server-side via the /search custom route.
func (h *MigrationProxy) List(ctx context.Context, orgID int64, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	annos, err := h.client.Search(ctx, orgID, query)
	if err != nil {
		return nil, err
	}

	// Collect unique createdBy values for batch user hydration.
	seen := make(map[string]bool)
	var createdByMeta []string
	for _, anno := range annos {
		if cb := anno.GetCreatedBy(); cb != "" && !seen[cb] {
			createdByMeta = append(createdByMeta, cb)
			seen[cb] = true
		}
	}
	userMap := map[string]*user.User{}
	if len(createdByMeta) > 0 {
		var err error
		userMap, err = h.client.GetUsersFromMeta(ctx, createdByMeta)
		if err != nil {
			h.logger.Warn("failed to hydrate annotation users", "err", err)
		}
	}

	dtos := make([]*annotations.ItemDTO, 0, len(annos))
	for _, anno := range annos {
		dto := annoToItemDTO(anno)
		if cb := anno.GetCreatedBy(); cb != "" {
			if u, ok := userMap[cb]; ok {
				applyUserToDTO(u, dto)
			}
		}
		dtos = append(dtos, dto)
	}
	return dtos, nil
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

	slices.SortFunc(merged, func(a, b *annotations.ItemDTO) int {
		if n := cmp.Compare(b.TimeEnd, a.TimeEnd); n != 0 {
			return n
		}
		return cmp.Compare(b.Time, a.Time)
	})

	if limit > 0 && int64(len(merged)) > limit {
		merged = merged[:limit]
	}
	return merged
}

// Create writes to new store and returns the assigned legacy ID.
func (h *MigrationProxy) Create(ctx context.Context, orgID int64, item *annotations.Item) (int64, error) {
	result, err := h.client.Create(ctx, orgID, itemToAnnotation(item))
	if err != nil {
		return 0, err
	}
	return annotationpkg.GetLegacyID(result), nil
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
	annotationpkg.SetLegacyID(anno, annotationID)
	// Preserve fields absent from the update command so the PUT doesn't clear them.
	if anno.Spec.DashboardUID == nil {
		anno.Spec.DashboardUID = existing.Spec.DashboardUID
	}
	if anno.Spec.PanelID == nil {
		anno.Spec.PanelID = existing.Spec.PanelID
	}
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

	createdBy := anno.GetCreatedBy()
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
		ID:           annotationpkg.GetLegacyID(anno),
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

// TODO: item.Data is not stored — consider adding a legacy_data field to the annotation schema to preserve it during migration.
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
		anno.SetCreatedBy(fmt.Sprintf("user:%d", item.UserID))
	}
	return anno
}
