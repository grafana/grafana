package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrReadForbidden = errutil.NewBase(
		errutil.StatusForbidden,
		"annotations.accesscontrol.read",
		errutil.WithPublicMessage("User missing permissions"),
	)
	ErrAccessControlInternal = errutil.NewBase(
		errutil.StatusInternal,
		"annotations.accesscontrol.internal",
		errutil.WithPublicMessage("Internal error while checking permissions"),
	)
)

type AuthService struct {
	db                                              db.DB
	features                                        featuremgmt.FeatureToggles
	dashSvc                                         dashboards.DashboardService
	dashboardsWithVisibleAnnotationsSearchPageLimit int64
}

func NewAuthService(db db.DB, features featuremgmt.FeatureToggles, dashSvc dashboards.DashboardService, cfg *setting.Cfg) *AuthService {
	section := cfg.Raw.Section("annotations")
	dashboardsWithVisibleAnnotationsSearchPageLimit := section.Key("dashboards_with_visible_annotations_search_dashboards_page_limit").MustInt64(1000)

	return &AuthService{
		db:       db,
		features: features,
		dashSvc:  dashSvc,
		dashboardsWithVisibleAnnotationsSearchPageLimit: dashboardsWithVisibleAnnotationsSearchPageLimit,
	}
}

// Authorize checks if the user has permission to read annotations, then returns a struct containing dashboards and scope types that the user has access to.
func (authz *AuthService) Authorize(ctx context.Context, query annotations.ItemQuery) (*AccessResources, error) {
	user := query.SignedInUser
	if user == nil || user.IsNil() {
		return nil, ErrReadForbidden.Errorf("missing user")
	}

	scopes, has := user.GetPermissions()[ac.ActionAnnotationsRead]
	if !has {
		return nil, ErrReadForbidden.Errorf("user does not have permission to read annotations")
	}
	scopeTypes := annotationScopeTypes(scopes)
	_, canAccessOrgAnnotations := scopeTypes[annotations.Organization.String()]
	_, canAccessDashAnnotations := scopeTypes[annotations.Dashboard.String()]
	if authz.features.IsEnabled(ctx, featuremgmt.FlagAnnotationPermissionUpdate) {
		canAccessDashAnnotations = true
	}

	var visibleDashboards map[string]int64
	var err error
	if canAccessDashAnnotations {
		if query.AnnotationID != 0 {
			annotationDashboardUID, err := authz.getAnnotationDashboard(ctx, query)
			if err != nil {
				return nil, ErrAccessControlInternal.Errorf("failed to fetch annotations: %w", err)
			}
			query.DashboardUID = annotationDashboardUID
		}

		visibleDashboards, err = authz.dashboardsWithVisibleAnnotations(ctx, query)
		if err != nil {
			return nil, ErrAccessControlInternal.Errorf("failed to fetch dashboards: %w", err)
		}
	}

	return &AccessResources{
		Dashboards:               visibleDashboards,
		CanAccessDashAnnotations: canAccessDashAnnotations,
		CanAccessOrgAnnotations:  canAccessOrgAnnotations,
	}, nil
}

func (authz *AuthService) getAnnotationDashboard(ctx context.Context, query annotations.ItemQuery) (string, error) {
	var items []annotations.Item
	params := make([]any, 0)
	err := authz.db.WithDbSession(ctx, func(sess *db.Session) error {
		sql := `
			SELECT
				a.id,
				a.org_id,
				a.dashboard_uid
			FROM annotation as a
			WHERE a.org_id = ? AND a.id = ?
			`
		params = append(params, query.OrgID, query.AnnotationID)

		return sess.SQL(sql, params...).Find(&items)
	})
	if err != nil {
		return "", err
	}
	if len(items) == 0 {
		return "", ErrAccessControlInternal.Errorf("annotation not found")
	}

	return items[0].DashboardUID, nil
}

func (authz *AuthService) dashboardsWithVisibleAnnotations(ctx context.Context, query annotations.ItemQuery) (map[string]int64, error) {
	recursiveQueriesSupported, err := authz.db.RecursiveQueriesAreSupported()
	if err != nil {
		return nil, err
	}

	filterType := searchstore.TypeDashboard
	if authz.features.IsEnabled(ctx, featuremgmt.FlagAnnotationPermissionUpdate) {
		filterType = searchstore.TypeAnnotation
	}

	filters := []any{
		permissions.NewAccessControlDashboardPermissionFilter(query.SignedInUser, dashboardaccess.PERMISSION_VIEW, filterType, authz.features, recursiveQueriesSupported, authz.db.GetDialect()),
		searchstore.OrgFilter{OrgId: query.OrgID},
	}

	if query.DashboardUID != "" {
		filters = append(filters, searchstore.DashboardFilter{
			UIDs: []string{query.DashboardUID},
		})
	}

	dashs, err := authz.dashSvc.SearchDashboards(ctx, &dashboards.FindPersistedDashboardsQuery{
		OrgId:        query.SignedInUser.GetOrgID(),
		Filters:      filters,
		SignedInUser: query.SignedInUser,
		Page:         query.Page,
		Type:         filterType,
		Limit:        authz.dashboardsWithVisibleAnnotationsSearchPageLimit,
	})
	if err != nil {
		return nil, err
	}

	visibleDashboards := make(map[string]int64)
	for _, d := range dashs {
		visibleDashboards[d.UID] = d.ID
	}

	return visibleDashboards, nil
}

func annotationScopeTypes(scopes []string) map[any]struct{} {
	allScopeTypes := map[any]struct{}{
		annotations.Dashboard.String():    {},
		annotations.Organization.String(): {},
	}

	types, hasWildcardScope := ac.ParseScopes(ac.ScopeAnnotationsProvider.GetResourceScopeType(""), scopes)
	if hasWildcardScope {
		types = allScopeTypes
	}

	return types
}
