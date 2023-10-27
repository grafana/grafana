package annotationsimpl

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/setting"
)

var ErrMissingPermissions = errors.New("missing permissions")

type RepositoryImpl struct {
	db       db.DB
	features featuremgmt.FeatureToggles
	store    store
}

func ProvideService(
	db db.DB,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	tagService tag.Service,
) *RepositoryImpl {
	l := log.New("annotations")

	return &RepositoryImpl{
		db:       db,
		features: features,
		store:    NewXormStore(cfg, l, db, tagService),
	}
}

func (r *RepositoryImpl) Save(ctx context.Context, item *annotations.Item) error {
	return r.store.Add(ctx, item)
}

// SaveMany inserts multiple annotations at once.
// It does not return IDs associated with created annotations. If you need this functionality, use the single-item Save instead.
func (r *RepositoryImpl) SaveMany(ctx context.Context, items []annotations.Item) error {
	return r.store.AddMany(ctx, items)
}

func (r *RepositoryImpl) Update(ctx context.Context, item *annotations.Item) error {
	return r.store.Update(ctx, item)
}

func getScopeTypes(user identity.Requester) (map[any]struct{}, error) {
	if user == nil || user.IsNil() {
		return nil, fmt.Errorf("missing user")
	}

	scopes, has := user.GetPermissions()[ac.ActionAnnotationsRead]
	if !has {
		return nil, fmt.Errorf("%w: %s", ErrMissingPermissions, ac.ActionAnnotationsRead)
	}

	types, hasWildcardScope := ac.ParseScopes(ac.ScopeAnnotationsProvider.GetResourceScopeType(""), scopes)
	if hasWildcardScope {
		types = map[interface{}]struct{}{annotations.Dashboard.String(): {}, annotations.Organization.String(): {}}
	}

	// if the user has access to any of the scopes necessary, we can return
	for _, t := range []string{annotations.Dashboard.String(), annotations.Organization.String()} {
		if _, ok := types[t]; ok {
			return types, nil
		}
	}

	return nil, fmt.Errorf("%w: no applicable scopes", ErrMissingPermissions)
}

func (r *RepositoryImpl) getUserVisibleDashboards(ctx context.Context, orgID int64, user identity.Requester) (map[string]int64, error) {
	recursiveQueriesAreSupported, err := r.db.RecursiveQueriesAreSupported()
	if err != nil {
		return nil, err
	}

	filters := []any{
		permissions.NewAccessControlDashboardPermissionFilter(user, dashboards.PERMISSION_VIEW, searchstore.TypeDashboard, r.features, recursiveQueriesAreSupported),
	}

	sb := &searchstore.Builder{Dialect: r.db.GetDialect(), Filters: filters}

	visibleDashboards := make(map[string]int64, 0)
	var page int64 = 1
	var limit int64 = 1000
	for {
		var res []annotations.DashboardProjection
		sql, params := sb.ToSQL(limit, page)

		err = r.db.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(sql, params...).Find(&res)
		})
		if err != nil {
			return nil, err
		}

		if len(res) == 0 {
			break
		}

		for _, p := range res {
			visibleDashboards[p.UID] = p.ID
		}

		page++
	}

	return visibleDashboards, nil
}

func (r *RepositoryImpl) Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	items := make([]*annotations.ItemDTO, 0)

	scopeTypes, err := getScopeTypes(query.SignedInUser)
	if err != nil {
		return items, err
	}

	visibleDashboards, err := r.getUserVisibleDashboards(ctx, query.OrgID, query.SignedInUser)
	if err != nil {
		return items, err
	}

	accessResources := annotations.AccessResources{
		Dashboards: visibleDashboards,
		ScopeTypes: scopeTypes,
	}

	return r.store.Get(ctx, query, accessResources)
}

func (r *RepositoryImpl) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return r.store.Delete(ctx, params)
}

func (r *RepositoryImpl) FindTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return r.store.GetTags(ctx, query)
}
