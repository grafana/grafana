package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/util/errutil"
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
	db       db.DB
	features featuremgmt.FeatureToggles
}

func NewAuthService(db db.DB, features featuremgmt.FeatureToggles) *AuthService {
	return &AuthService{
		db:       db,
		features: features,
	}
}

// Authorize checks if the user has permission to read annotations, then returns a struct containing dashboards and scope types that the user has access to.
func (authz *AuthService) Authorize(ctx context.Context, orgID int64, query *annotations.ItemQuery) (*AccessResources, error) {
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
			annotationDashboardID, err := authz.getAnnotationDashboard(ctx, query, orgID)
			if err != nil {
				return nil, ErrAccessControlInternal.Errorf("failed to fetch annotations: %w", err)
			}
			query.DashboardID = annotationDashboardID
		}

		visibleDashboards, err = authz.dashboardsWithVisibleAnnotations(ctx, query, orgID)
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

func (authz *AuthService) getAnnotationDashboard(ctx context.Context, query *annotations.ItemQuery, orgID int64) (int64, error) {
	var items []annotations.Item
	params := make([]any, 0)
	err := authz.db.WithDbSession(ctx, func(sess *db.Session) error {
		sql := `
			SELECT
				a.id,
				a.org_id,
				d.id as dashboard_id
			FROM annotation as a
			INNER JOIN dashboard as d ON a.dashboard_id = d.id
			WHERE a.org_id = ? AND a.id = ?
			`
		params = append(params, orgID, query.AnnotationID)

		return sess.SQL(sql, params...).Find(&items)
	})
	if err != nil {
		return 0, err
	}
	if len(items) == 0 {
		return 0, ErrAccessControlInternal.Errorf("annotation not found")
	}

	return items[0].DashboardID, nil
}

func (authz *AuthService) dashboardsWithVisibleAnnotations(ctx context.Context, query *annotations.ItemQuery, orgID int64) (map[string]int64, error) {
	recursiveQueriesSupported, err := authz.db.RecursiveQueriesAreSupported()
	if err != nil {
		return nil, err
	}

	filterType := searchstore.TypeDashboard
	if authz.features.IsEnabled(ctx, featuremgmt.FlagAnnotationPermissionUpdate) {
		filterType = searchstore.TypeAnnotation
	}

	filters := []any{
		permissions.NewAccessControlDashboardPermissionFilter(query.SignedInUser, dashboardaccess.PERMISSION_VIEW, filterType, authz.features, recursiveQueriesSupported),
		searchstore.OrgFilter{OrgId: orgID},
	}

	if query.DashboardUID != "" {
		filters = append(filters, searchstore.DashboardFilter{
			UIDs: []string{query.DashboardUID},
		})
	}
	if query.DashboardID != 0 {
		filters = append(filters, searchstore.DashboardIDFilter{
			IDs: []int64{query.DashboardID},
		})
	}

	sb := &searchstore.Builder{Dialect: authz.db.GetDialect(), Filters: filters, Features: authz.features}

	visibleDashboards := make(map[string]int64)

	var page int64 = 1
	var limit int64 = 1000
	for {
		var res []dashboardProjection
		sql, params := sb.ToSQL(limit, page)

		err = authz.db.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(sql, params...).Find(&res)
		})
		if err != nil {
			return nil, err
		}

		for _, p := range res {
			visibleDashboards[p.UID] = p.ID
		}

		// if the result is less than the limit, we have reached the end
		if len(res) < int(limit) {
			break
		}

		page++
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
