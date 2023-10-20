package annotationsimpl

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/setting"
)

var timeNow = time.Now

type RepositoryImpl struct {
	store            store
	dashboardService dashboards.DashboardService
}

func ProvideService(
	db db.DB,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	tagService tag.Service,
	dashboardService dashboards.DashboardService,
) *RepositoryImpl {
	return &RepositoryImpl{
		store: &xormRepositoryImpl{
			cfg:               cfg,
			features:          features,
			db:                db,
			log:               log.New("annotations"),
			tagService:        tagService,
			maximumTagsLength: cfg.AnnotationMaximumTagsLength,
		},
		dashboardService: dashboardService,
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

func (r *RepositoryImpl) getAllowedTypes(user identity.Requester) (map[any]struct{}, error) {
	if user == nil || user.IsNil() {
		return nil, errors.New("missing permissions")
	}

	scopes, has := user.GetPermissions()[ac.ActionAnnotationsRead]
	if !has {
		return nil, errors.New("missing permissions")
	}

	types, hasWildcardScope := ac.ParseScopes(ac.ScopeAnnotationsProvider.GetResourceScopeType(""), scopes)
	if hasWildcardScope {
		types = map[interface{}]struct{}{annotations.Dashboard.String(): {}, annotations.Organization.String(): {}}
	}
	return types, nil
}

func (r *RepositoryImpl) getAllowedDashboards(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.DashboardProjection, error) {
	allowed := []*annotations.DashboardProjection{}

	dbQuery := dashboards.FindPersistedDashboardsQuery{
		OrgId:        query.OrgID,
		SignedInUser: query.SignedInUser,
		Limit:        -1,
		Permission:   dashboards.PERMISSION_VIEW,
		Sort:         model.SortOption{},
	}

	var page int64 = 1
	for {
		q := dbQuery
		q.Page = page
		proj, err := r.dashboardService.FindDashboards(ctx, &q)
		if err != nil {
			return nil, errors.New("could not fetch dashboards")
		}

		if len(proj) == 0 {
			break
		}

		for _, p := range proj {
			allowed = append(allowed, &annotations.DashboardProjection{
				ID:  p.ID,
				UID: p.UID,
			})
		}

		page++
	}

	return allowed, nil
}

func (r *RepositoryImpl) Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	items := make([]*annotations.ItemDTO, 0)

	allowedTypes, err := r.getAllowedTypes(query.SignedInUser)
	if err != nil {
		return items, err
	}

	allowedDashboards, err := r.getAllowedDashboards(ctx, query)
	if err != nil {
		return items, err
	}

	accessResources := annotations.AccessResources{
		Dashboards: allowedDashboards,
		Types:      allowedTypes,
	}

	return r.store.Get(ctx, query, accessResources)
}

func (r *RepositoryImpl) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return r.store.Delete(ctx, params)
}

func (r *RepositoryImpl) FindTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return r.store.GetTags(ctx, query)
}
