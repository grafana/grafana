package annotationsapi

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// annotationProxy is the subset of MigrationProxy the repository depends on:
// it forwards annotation operations to the new API server.
// Implemented by *MigrationProxy.
type annotationProxy interface {
	Create(ctx context.Context, orgID int64, item *annotations.Item) (int64, error)
	CreateWithLegacyID(ctx context.Context, orgID int64, item *annotations.Item, legacyID int64) error
	Update(ctx context.Context, orgID int64, annotationID int64, item *annotations.Item) error
	Delete(ctx context.Context, orgID int64, annotationID int64) error
	Get(ctx context.Context, orgID int64, annotationID int64) (*annotations.ItemDTO, error)
	List(ctx context.Context, orgID int64, query *annotations.ItemQuery) ([]*annotations.ItemDTO, map[int64]bool, error)
}

var _ annotations.Repository = (*migrationRepository)(nil)

// migrationRepository is an annotations.Repository that wraps the legacy repository and
// routes reads and writes to the new API server based on the migration phase.
// Temporary shim for the duration of the migration.
type migrationRepository struct {
	legacy  annotations.Repository
	proxy   annotationProxy
	cfg     *setting.Cfg
	userSvc user.Service
	logger  log.Logger
}

// NewMigrationRepository returns the wrapper when the migration is on, or the legacy
// repository unchanged when it is off.
func NewMigrationRepository(legacy annotations.Repository, proxy *MigrationProxy, cfg *setting.Cfg, userSvc user.Service) annotations.Repository {
	if !cfg.AnnotationAppPlatform.ProxyEnabled() {
		return legacy
	}
	return &migrationRepository{
		legacy:  legacy,
		proxy:   proxy,
		cfg:     cfg,
		userSvc: userSvc,
		logger:  log.New("annotations.migration-repository"),
	}
}

func (r *migrationRepository) Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	switch {
	case isAlertQuery(query):
		return r.legacy.Find(ctx, query) // alerts live only in legacy
	case query.AnnotationID != 0:
		return r.findByID(ctx, query) // one specific annotation
	default:
		return r.search(ctx, query) // filtered search
	}
}

// search lists from the new store and merges in whatever legacy still owns for this query.
// TODO: the stores order by different keys but share one limit, so a range annotation near the
// boundary can be dropped after the merge. Tracked for a follow-up PR.
func (r *migrationRepository) search(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	// The new store filters users by UID, so translate the query's legacy user ID first.
	r.resolveUserUID(ctx, query)

	newItems, deletedIDs, err := r.proxy.List(ctx, query.OrgID, query)
	if err != nil {
		// In proxy-all the new store is authoritative; a silent legacy fallback would
		// hide annotations behind a 200. Only degrade while legacy still holds everything.
		if r.cfg.AnnotationAppPlatform.ProxyAll() {
			return nil, err
		}
		r.logger.Warn("new store list failed, returning legacy results only", "err", err)
		newItems, deletedIDs = nil, nil
	}

	legacyItems, err := r.legacyToMerge(ctx, query)
	if err != nil {
		return nil, err
	}
	if legacyItems == nil {
		return newItems, nil // new store is authoritative
	}
	return Merge(newItems, legacyItems, deletedIDs, query.Limit), nil
}

// legacyToMerge returns the legacy items to merge with the new store, or nil when the new
// store already holds everything for this query.
func (r *migrationRepository) legacyToMerge(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	// In the proxy-writes phase the new store only has annotations created since the
	// migration started, so we still merge in everything from legacy.
	if !r.cfg.AnnotationAppPlatform.ProxyAll() {
		return r.legacy.Find(ctx, query)
	}

	// From here we are in the proxy-all phase: the new store holds all user annotations.
	// A search for user annotations is fully served by the new store, so nothing to merge.
	if query.Type == "annotation" {
		return nil, nil
	}

	// A broader search still needs alert annotations, which only legacy has.
	alertQuery := *query
	alertQuery.Type = "alert"
	return r.legacy.Find(ctx, &alertQuery)
}

// findByID reads a single annotation from the new store, falling back to legacy when the
// record is not there yet (pre-migration record or an alert annotation). A record that was
// explicitly deleted in the new store (ErrGone) must not fall back to legacy.
func (r *migrationRepository) findByID(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	dto, err := r.proxy.Get(ctx, query.OrgID, query.AnnotationID)
	switch {
	case err == nil:
		return []*annotations.ItemDTO{dto}, nil
	case errors.Is(err, ErrGone):
		// deleted in new store, don't fall back to legacy
		return nil, nil
	case errors.Is(err, ErrNotFound):
		return r.legacy.Find(ctx, query)
	default:
		return nil, err
	}
}

// resolveUserUID sets query.UserUID from query.UserID. The new store filters by UID, so
// without it the createdBy filter is skipped.
func (r *migrationRepository) resolveUserUID(ctx context.Context, query *annotations.ItemQuery) {
	if query.UserID == 0 || query.UserUID != "" {
		return
	}
	u, err := r.userSvc.GetByID(ctx, &user.GetUserByIDQuery{ID: query.UserID})
	if err != nil {
		r.logger.Warn("failed to resolve user UID, skipping createdBy filter", "userID", query.UserID, "err", err)
		return
	}
	query.UserUID = u.UID
}

func isAlertQuery(query *annotations.ItemQuery) bool {
	return query.Type == "alert" || query.AlertID != 0 || query.AlertUID != ""
}

// Save writes to the new store and copies the new legacy ID onto item.ID.
func (r *migrationRepository) Save(ctx context.Context, item *annotations.Item) error {
	legacyID, err := r.proxy.Create(ctx, item.OrgID, item)
	if err != nil {
		return err
	}
	item.ID = legacyID
	return nil
}

// SaveMany is not proxied. It is only used for alerting annotations, which stay in legacy.
func (r *migrationRepository) SaveMany(ctx context.Context, items []annotations.Item) error {
	return r.legacy.SaveMany(ctx, items)
}

// Update writes to the new store. Legacy is read-only from proxy-writes on, so a record that
// only exists in legacy (ErrNotFound) is migrated: the update is applied over the legacy copy
// and the result is created in the new store under its original ID, leaving legacy untouched.
// On ErrGone (explicitly deleted in the new store) it returns the error without migrating, so
// a tombstoned annotation is not silently resurrected.
func (r *migrationRepository) Update(ctx context.Context, item *annotations.Item) error {
	err := r.proxy.Update(ctx, item.OrgID, item.ID, item)
	if err == nil || !errors.Is(err, ErrNotFound) {
		return err
	}

	// Not in the new store yet. Migrate the legacy copy with the update applied.
	existing, err := r.findLegacyByID(ctx, item.OrgID, item.ID)
	if err != nil {
		return err // ErrNotFound here means the record exists nowhere.
	}
	merged := mergeUpdateOverLegacy(existing, item)
	return r.proxy.CreateWithLegacyID(ctx, item.OrgID, merged, item.ID)
}

// Delete soft-deletes one annotation in the new store. The legacy copy is left untouched
// (legacy stays read-only during the migration); the tombstone in the new store suppresses
// that copy from merged reads, so the annotation does not resurface. A record that only
// exists in legacy (ErrNotFound) is first migrated under its original ID, then soft-deleted,
// so the tombstone matches the legacy copy. ErrGone means it was already deleted, treated as
// an idempotent success.
func (r *migrationRepository) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	// No ID means a mass delete by dashboard/panel, which the proxy can't express.
	// TODO: mass delete still writes to legacy; the new store can't express it yet.
	if params.ID == 0 {
		return r.legacy.Delete(ctx, params)
	}
	err := r.proxy.Delete(ctx, params.OrgID, params.ID)
	switch {
	case err == nil, errors.Is(err, ErrGone):
		return nil
	case !errors.Is(err, ErrNotFound):
		return err
	}

	// Not in the new store yet. Migrate the legacy copy, then soft-delete it so the
	// tombstone suppresses the un-purged legacy row from merged reads.
	existing, err := r.findLegacyByID(ctx, params.OrgID, params.ID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil // nothing anywhere; delete is idempotent
		}
		return err
	}
	if err := r.proxy.CreateWithLegacyID(ctx, params.OrgID, legacyDTOToItem(existing), params.ID); err != nil {
		return err
	}
	// Create succeeded; if the soft-delete fails we surface the error. A retry re-enters
	// Delete, finds the now-migrated record, and tombstones it directly.
	return r.proxy.Delete(ctx, params.OrgID, params.ID)
}

// findLegacyByID reads a single annotation from legacy by ID, returning ErrNotFound when the
// record does not exist there either.
func (r *migrationRepository) findLegacyByID(ctx context.Context, orgID, id int64) (*annotations.ItemDTO, error) {
	items, err := r.legacy.Find(ctx, &annotations.ItemQuery{OrgID: orgID, AnnotationID: id})
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrNotFound
	}
	return items[0], nil
}

// legacyDTOToItem builds the Item to migrate from a legacy annotation, carrying the fields
// the new store persists on create.
func legacyDTOToItem(dto *annotations.ItemDTO) *annotations.Item {
	item := &annotations.Item{
		Epoch:    dto.Time,
		EpochEnd: dto.TimeEnd,
		Text:     dto.Text,
		Tags:     dto.Tags,
		PanelID:  dto.PanelID,
		UserID:   dto.UserID,
		Data:     dto.Data,
	}
	if dto.DashboardUID != nil {
		item.DashboardUID = *dto.DashboardUID
	}
	return item
}

// mergeUpdateOverLegacy applies the caller's update fields on top of the legacy record. The
// UpdateAnnotation command carries text/time/tags/data but not the dashboard/panel binding,
// so those are taken from the legacy copy to avoid clearing them on migration.
func mergeUpdateOverLegacy(existing *annotations.ItemDTO, update *annotations.Item) *annotations.Item {
	merged := legacyDTOToItem(existing)
	merged.Text = update.Text
	merged.Epoch = update.Epoch
	merged.EpochEnd = update.EpochEnd
	merged.Tags = update.Tags
	if update.Data != nil {
		merged.Data = update.Data
	}
	// The update may carry the dashboard/panel binding (PatchAnnotation does); prefer it.
	if update.DashboardUID != "" {
		merged.DashboardUID = update.DashboardUID
	}
	if update.PanelID != 0 {
		merged.PanelID = update.PanelID
	}
	return merged
}

// TODO: FindTags reads from legacy only. Follow up to proxy tag searches to the new store.
func (r *migrationRepository) FindTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return r.legacy.FindTags(ctx, query)
}
