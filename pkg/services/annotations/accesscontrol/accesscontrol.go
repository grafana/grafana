package accesscontrol

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

var ErrMissingPermissions = errors.New("missing permissions")

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
func (authz *AuthService) Authorize(ctx context.Context, orgID int64, user identity.Requester) (*AccessResources, error) {
	if orgID == 0 {
		return nil, fmt.Errorf("missing orgID")
	}

	if user == nil || user.IsNil() {
		return nil, fmt.Errorf("missing user")
	}

	scopeTypes, err := userScopeTypes(user)
	if err != nil {
		return nil, err
	}

	visibleDashboards, err := authz.userVisibleDashboards(ctx, user, orgID)
	if err != nil {
		return nil, err
	}

	return &AccessResources{
		Dashboards: visibleDashboards,
		ScopeTypes: scopeTypes,
	}, nil
}

func (authz *AuthService) userVisibleDashboards(ctx context.Context, user identity.Requester, orgID int64) (map[string]int64, error) {
	recursiveQueriesSupported, err := authz.db.RecursiveQueriesAreSupported()
	if err != nil {
		return nil, err
	}

	filters := []any{
		permissions.NewAccessControlDashboardPermissionFilter(user, dashboards.PERMISSION_VIEW, searchstore.TypeDashboard, authz.features, recursiveQueriesSupported),
	}
	filters = append(filters, searchstore.OrgFilter{OrgId: orgID})

	sb := &searchstore.Builder{Dialect: authz.db.GetDialect(), Filters: filters}

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

func userScopeTypes(user identity.Requester) (map[any]struct{}, error) {
	annotationScopeTypes := map[any]struct{}{
		annotations.Dashboard.String():    {},
		annotations.Organization.String(): {},
	}

	scopes, has := user.GetPermissions()[ac.ActionAnnotationsRead]
	if !has {
		return nil, fmt.Errorf("%w: %s", ErrMissingPermissions, ac.ActionAnnotationsRead)
	}

	types, hasWildcardScope := ac.ParseScopes(ac.ScopeAnnotationsProvider.GetResourceScopeType(""), scopes)
	if hasWildcardScope {
		types = annotationScopeTypes
	}

	for t := range annotationScopeTypes {
		if _, ok := types[t]; ok {
			return types, nil
		}
	}

	return nil, fmt.Errorf("%w: no applicable scopes", ErrMissingPermissions)
}
