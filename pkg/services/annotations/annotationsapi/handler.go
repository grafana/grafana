package annotationsapi

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	annotationpkg "github.com/grafana/grafana/pkg/registry/apps/annotation"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ErrNotFound is returned by proxy methods when the annotation is not in the new storage
var ErrNotFound = errors.New("annotation not found in new store")

// ErrGone is returned by proxy methods when the annotation was explicitly deleted
// (soft-deleted / tombstoned) in the new store. Unlike ErrNotFound, callers must
// NOT fall back to legacy on this error as the record is authoritatively deleted.
var ErrGone = errors.New("annotation has been deleted in new store")

// mapClientErr translates the new API server's HTTP status into proxy sentinels so
// callers can distinguish "never migrated" (404 → fall back to legacy) from
// "explicitly deleted" (410 → do not fall back).
func mapClientErr(err error) error {
	switch {
	case err == nil:
		return nil
	case apierrors.IsGone(err):
		return ErrGone
	case apierrors.IsNotFound(err):
		return ErrNotFound
	default:
		return err
	}
}

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
	client *annotationAPIClient
	logger log.Logger
}

func ProvideMigrationProxy(cfg *setting.Cfg, userSvc user.Service) (*MigrationProxy, error) {
	phase := cfg.AnnotationAppPlatform.APIMigrationPhase

	if phase == "off" {
		return nil, nil
	}

	switch phase {
	case "proxy-writes", "proxy-all":
	default:
		return nil, fmt.Errorf("annotation proxy: unknown api_migration_phase %q: must be one of off, proxy-writes, proxy-all", phase)
	}

	if strings.TrimSpace(cfg.AnnotationAppPlatform.APIServerURL) == "" {
		return nil, fmt.Errorf("annotation proxy: api_server_url must be set when api_migration_phase is %q", phase)
	}

	c, err := newAnnotationAPIClient(cfg, userSvc)
	if err != nil {
		return nil, err
	}

	return &MigrationProxy{
		client: c,
		logger: log.New("annotationsapi"),
	}, nil
}

// List fetches annotations from the new store matching query and returns the live ones as
// ItemDTOs, plus the legacy IDs of any soft-deleted matches. All filtering including tags is
// handled server-side via the /search custom route (which includes tombstones). The deleted
// IDs let the caller suppress un-purged legacy copies from merged reads.
func (h *MigrationProxy) List(ctx context.Context, orgID int64, query *annotations.ItemQuery) ([]*annotations.ItemDTO, map[int64]bool, error) {
	annos, err := h.client.Search(ctx, orgID, query)
	if err != nil {
		return nil, nil, err
	}

	// Split live annotations from tombstones. Tombstones are not results; they only mark
	// which legacy IDs must be suppressed from the merge.
	live := annos[:0]
	deletedIDs := map[int64]bool{}
	for _, anno := range annos {
		if anno.GetDeletionTimestamp() != nil {
			if id := annotationpkg.GetLegacyID(anno); id != 0 {
				deletedIDs[id] = true
			}
			continue
		}
		live = append(live, anno)
	}

	// Collect unique createdBy values for batch user hydration.
	seen := make(map[string]bool)
	var createdByMeta []string
	for _, anno := range live {
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

	dtos := make([]*annotations.ItemDTO, 0, len(live))
	for _, anno := range live {
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
	return dtos, deletedIDs, nil
}

// Merge combines new-store and legacy items, deduplicates by legacyID (new store wins),
// drops legacy items whose legacyID is tombstoned in the new store (deletedIDs), sorts by
// time descending, and applies limit.
func Merge(newItems, legacyItems []*annotations.ItemDTO, deletedIDs map[int64]bool, limit int64) []*annotations.ItemDTO {
	inNew := make(map[int64]bool, len(newItems))
	for _, item := range newItems {
		inNew[item.ID] = true
	}

	merged := make([]*annotations.ItemDTO, 0, len(newItems)+len(legacyItems))
	merged = append(merged, newItems...)
	for _, item := range legacyItems {
		if inNew[item.ID] || deletedIDs[item.ID] {
			continue // new store owns it, or it was explicitly deleted there
		}
		merged = append(merged, item)
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

// getByLegacyID fetches the annotation for annotationID and maps a tombstone to ErrGone,
// so callers can distinguish a never-migrated record (ErrNotFound → fall back to legacy)
// from one explicitly deleted in the new store (ErrGone → do NOT fall back).
func (h *MigrationProxy) getByLegacyID(ctx context.Context, orgID int64, annotationID int64) (*annotationV0.Annotation, error) {
	anno, err := h.client.GetByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return nil, err
	}
	if anno.GetDeletionTimestamp() != nil {
		return nil, ErrGone
	}
	return anno, nil
}

// Update writes to new store. Returns ErrNotFound if the record is not there yet, caller falls back to legacy.
// TODO: only text/tags are updated; editing time needs annotation delete + re-insert since the store partitions on time.
func (h *MigrationProxy) Update(ctx context.Context, orgID int64, annotationID int64, item *annotations.Item) error {
	existing, err := h.getByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return err
	}
	anno, err := itemToAnnotation(item)
	if err != nil {
		return err
	}
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
	// A concurrent delete between resolve and write surfaces as 410; map it so the
	// caller treats it as Gone (no legacy fallback) rather than a raw error.
	return mapClientErr(err)
}

// Delete soft-deletes in the new store. Returns ErrNotFound if the record is not
// there yet (caller falls back to legacy) or ErrGone if it was already deleted.
func (h *MigrationProxy) Delete(ctx context.Context, orgID int64, annotationID int64) error {
	existing, err := h.getByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return err
	}
	return mapClientErr(h.client.Delete(ctx, orgID, existing.GetName()))
}

// Get reads a single annotation from the new store. Returns ErrNotFound if the
// record is not there yet (caller falls back to legacy) or ErrGone if it was
// explicitly deleted (caller must not fall back).
func (h *MigrationProxy) Get(ctx context.Context, orgID int64, annotationID int64) (*annotations.ItemDTO, error) {
	anno, err := h.getByLegacyID(ctx, orgID, annotationID)
	if err != nil {
		return nil, err
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
