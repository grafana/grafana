package annotationsapi

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	authnlib "github.com/grafana/authlib/authn"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	annotationpkg "github.com/grafana/grafana/pkg/registry/apps/annotation"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
)

// ErrNotFound is returned by proxy methods when the annotation is not in the new storage
var ErrNotFound = errors.New("annotation not found in new store")

// ErrGone is returned when the annotation was soft-deleted (tombstoned) in the new store.
// Unlike ErrNotFound, callers must NOT fall back to legacy as the new store is authoritative
// and the record is deleted.
var ErrGone = errors.New("annotation has been deleted in new store")

// partialDecodeError signals that one or more optional fields could not be decoded
// from an annotation. The annotation is still usable without those fields, so callers
// can return the DTO (minus the affected fields) rather than dropping it.
type partialDecodeError struct {
	Fields []string
	Err    error
}

func (e *partialDecodeError) Error() string {
	return fmt.Sprintf("decoding fields %v: %v", e.Fields, e.Err)
}

func (e *partialDecodeError) Unwrap() error { return e.Err }

// MigrationProxy routes annotation writes to the new API server.
type MigrationProxy struct {
	client annotationClient
	logger log.Logger
}

// ProvideMigrationProxy builds the proxy that routes legacy annotation operations to the new API server.
func ProvideMigrationProxy(cfg *setting.Cfg, userSvc user.Service, exchanger authnlib.TokenExchanger) (*MigrationProxy, error) {
	phase := cfg.AnnotationAppPlatform.APIMigrationPhase

	if phase == "off" {
		return nil, nil
	}

	switch phase {
	case setting.AnnotationAPIMigrationPhaseProxyWrites, setting.AnnotationAPIMigrationPhaseProxyAll:
	default:
		return nil, fmt.Errorf("annotation proxy: unknown api_migration_phase %q: must be one of off, proxy-writes, proxy-all", phase)
	}

	if strings.TrimSpace(cfg.AnnotationAppPlatform.APIServerURL) == "" {
		return nil, fmt.Errorf("annotation proxy: api_server_url must be set when api_migration_phase is %q", phase)
	}

	return &MigrationProxy{
		client: newAnnotationAPIClient(cfg, userSvc, exchanger),
		logger: log.New("annotationsapi"),
	}, nil
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
		dto, err := annoToItemDTO(anno)
		if err != nil {
			var decodeErr *partialDecodeError
			if !errors.As(err, &decodeErr) {
				h.logger.Warn("failed to convert annotation to DTO, dropping it",
					"namespace", anno.GetNamespace(), "name", anno.GetName(), "err", err)
				continue
			}
			h.logger.Warn("failed to decode fields on annotation, returning it without those fields",
				"namespace", anno.GetNamespace(), "name", anno.GetName(), "fields", decodeErr.Fields, "err", decodeErr.Err)
		}
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
	anno, err := itemToAnnotation(item)
	if err != nil {
		return 0, err
	}
	result, err := h.client.Create(ctx, orgID, anno)
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
	if existing.GetDeletionTimestamp() != nil {
		return ErrGone
	}
	// Mutate a copy of the stored record and apply only the fields the caller supplied.
	// This aligns with the legacy API behavior where only the fields present in the request are updated.
	anno := existing.DeepCopy()
	anno.Spec.Text = item.Text
	anno.Spec.Tags = item.Tags
	if item.Epoch != 0 {
		anno.Spec.Time = item.Epoch
	}
	// Legacy API treats a point annotation as having EpochEnd == Epoch, so if the caller
	// sends EpochEnd == Epoch, we treat it as a point and clear the end time. This prevents
	// it from changing to a range when the caller only intended to move the point in time.
	isPoint := existing.Spec.TimeEnd == nil && item.EpochEnd == existing.Spec.Time
	if isPoint {
		anno.Spec.TimeEnd = nil
	} else if item.EpochEnd != 0 {
		anno.Spec.TimeEnd = &item.EpochEnd
	}
	if item.Data != nil {
		raw, err := item.Data.Encode()
		if err != nil {
			return fmt.Errorf("encoding legacy data: %w", err)
		}
		annotationpkg.SetLegacyData(anno, string(raw))
	}

	// If time or timeEnd changed, re-create the annotation as the new API does not support updates to time/timeEnd
	timeChanged := existing.Spec.Time != anno.Spec.Time || !ptr.Equal(existing.Spec.TimeEnd, anno.Spec.TimeEnd)
	if timeChanged {
		return h.recreateWithNewTime(ctx, orgID, existing, anno)
	}

	_, err = h.client.Update(ctx, orgID, anno)
	return err
}

// recreateWithNewTime moves an annotation to a new time by creating a new record and then
// deleting the old one. The new record keeps the same legacy ID, so the change is transparent to the
// legacy API.
//
// Note: A potential side-effect of this is that if a user other than the creator edits an annotation,
// the annotation becomes attributed to that user instead.
func (h *MigrationProxy) recreateWithNewTime(ctx context.Context, orgID int64, existing, anno *annotationV0.Annotation) error {
	anno.SetName("")
	anno.SetGenerateName("a-")
	anno.SetResourceVersion("")
	if _, err := h.client.Create(ctx, orgID, anno); err != nil {
		return err
	}

	if err := h.client.Delete(ctx, orgID, existing.GetName()); err != nil {
		// Best-effort delete. If this fails, there would be two live records
		// with different k8s resource names in the new store.
		h.logger.Warn("failed to delete old annotation after time edit",
			"orgID", orgID, "name", existing.GetName(), "err", err)
	}
	return nil
}

// Delete soft-deletes in the new store. Returns ErrNotFound if the record is not
// there yet (caller falls back to legacy) or ErrGone if it was already deleted.
func (h *MigrationProxy) Delete(ctx context.Context, orgID int64, annotationID int64) error {
	existing, err := h.client.GetByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return err
	}
	if existing.GetDeletionTimestamp() != nil {
		return ErrGone
	}
	return h.client.Delete(ctx, orgID, existing.GetName())
}

// Get reads a single annotation from the new store. Returns ErrNotFound if the
// record is not there yet (caller falls back to legacy) or ErrGone if it was
// soft-deleted (caller must not fall back).
func (h *MigrationProxy) Get(ctx context.Context, orgID int64, annotationID int64) (*annotations.ItemDTO, error) {
	anno, err := h.client.GetByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return nil, err
	}
	if anno.GetDeletionTimestamp() != nil {
		return nil, ErrGone
	}

	dto, err := annoToItemDTO(anno)
	if err != nil {
		var decodeErr *partialDecodeError
		if !errors.As(err, &decodeErr) {
			return nil, err
		}
		h.logger.Warn("failed to decode fields on annotation, returning it without those fields",
			"namespace", anno.GetNamespace(), "name", anno.GetName(), "fields", decodeErr.Fields, "err", decodeErr.Err)
	}

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

func annoToItemDTO(anno *annotationV0.Annotation) (*annotations.ItemDTO, error) {
	dto := &annotations.ItemDTO{
		ID:           annotationpkg.GetLegacyID(anno),
		Text:         anno.Spec.Text,
		Time:         anno.Spec.Time,
		Tags:         anno.Spec.Tags,
		DashboardUID: anno.Spec.DashboardUID,
	}
	if anno.Spec.TimeEnd != nil {
		dto.TimeEnd = *anno.Spec.TimeEnd
	} else {
		// Set TimeEnd to Time for point annotations to align with the legacy API response,
		// so the downsteam Merge sorts new-store and legacy-store points consistently.
		dto.TimeEnd = anno.Spec.Time
	}
	if anno.Spec.PanelID != nil {
		dto.PanelID = *anno.Spec.PanelID
	}
	if ts := anno.GetCreationTimestamp(); !ts.IsZero() {
		dto.Created = ts.UnixMilli()
	}
	if raw, ok := annotationpkg.GetLegacyData(anno); ok && raw != "" {
		data, err := simplejson.NewJson([]byte(raw))
		if err != nil {
			return dto, &partialDecodeError{Fields: []string{"data"}, Err: err}
		}
		dto.Data = data
	}
	return dto, nil
}

func itemToAnnotation(item *annotations.Item) (*annotationV0.Annotation, error) {
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

	anno := &annotationV0.Annotation{
		TypeMeta: metav1.TypeMeta{
			APIVersion: annotationV0.GroupVersion.String(),
			Kind:       annotationV0.AnnotationKind().Kind(),
		},
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "a-",
		},
		Spec: spec,
	}

	if item.Data != nil {
		raw, err := item.Data.Encode()
		if err != nil {
			return anno, fmt.Errorf("encoding legacy data: %w", err)
		}
		annotationpkg.SetLegacyData(anno, string(raw))
	}

	return anno, nil
}
