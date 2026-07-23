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
	Update(ctx context.Context, orgID int64, annotationID int64, item *annotations.Item) error
	Delete(ctx context.Context, orgID int64, annotationID int64) error
	Get(ctx context.Context, orgID int64, annotationID int64) (*annotations.ItemDTO, error)
	List(ctx context.Context, orgID int64, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error)
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
func (r *migrationRepository) search(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	// The new store filters users by UID, so translate the query's legacy user ID first.
	r.resolveUserUID(ctx, query)

	newItems, err := r.proxy.List(ctx, query.OrgID, query)
	if err != nil {
		// In proxy-all the new store is authoritative; a silent legacy fallback would
		// hide annotations behind a 200. Only degrade while legacy still holds everything.
		if r.cfg.AnnotationAppPlatform.ProxyAll() {
			return nil, err
		}
		r.logger.Warn("new store list failed, returning legacy results only", "err", err)
		newItems = nil
	}

	legacyItems, err := r.legacyToMerge(ctx, query)
	if err != nil {
		return nil, err
	}
	if legacyItems == nil {
		return newItems, nil // new store is authoritative
	}
	return Merge(newItems, legacyItems, query.Limit), nil
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
// record is not there yet (pre-migration record or an alert annotation). A record deleted
// in the new store (ErrGone) is authoritatively gone and must not fall back to legacy.
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

// Update writes to the new store. On ErrNotFound (older record) it falls back to legacy,
// which preserves any Data the caller omits. On ErrGone (deleted in the new store) it
// returns the error without falling back, so an update can't resurrect a deleted record.
func (r *migrationRepository) Update(ctx context.Context, item *annotations.Item) error {
	err := r.proxy.Update(ctx, item.OrgID, item.ID, item)
	if err == nil || !errors.Is(err, ErrNotFound) {
		return err
	}
	return r.legacy.Update(ctx, item)
}

// Delete removes one annotation from both stores.
// When a record is not in the new store yet (ErrNotFound), legacy still owns it so we delete it there.
// When a record is already deleted in the new store (ErrGone), we still best-effort delete the
// legacy record to ensure consistency.
func (r *migrationRepository) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	// No ID means a mass delete by dashboard/panel, which the proxy can't express.
	if params.ID == 0 {
		return r.legacy.Delete(ctx, params)
	}
	err := r.proxy.Delete(ctx, params.OrgID, params.ID)
	switch {
	case err == nil, errors.Is(err, ErrGone):
		// Best-effort delete the legacy copy. A failure means the annotation could
		// briefly resurface in a merged read until legacy is retired for the instance.
		// A re-delete would land here again and retry the cleanup.
		if err := r.legacy.Delete(ctx, params); err != nil {
			r.logger.Warn("failed to delete legacy copy after new-store delete", "id", params.ID, "err", err)
		}
		return nil
	case errors.Is(err, ErrNotFound):
		return r.legacy.Delete(ctx, params)
	default:
		return err
	}
}

// TODO: FindTags reads from legacy only. Follow up to proxy tag searches to the new store.
func (r *migrationRepository) FindTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return r.legacy.FindTags(ctx, query)
}
