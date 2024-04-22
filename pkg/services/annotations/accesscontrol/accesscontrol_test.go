package accesscontrol

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/testutil"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAuthorize(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sql := db.InitTestDB(t)
	cfg := sql.Cfg

	dash1 := testutil.CreateDashboard(t, sql, cfg, featuremgmt.WithFeatures(), dashboards.SaveDashboardCommand{
		UserID: 1,
		OrgID:  1,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 1",
		}),
	})

	dash2 := testutil.CreateDashboard(t, sql, cfg, featuremgmt.WithFeatures(), dashboards.SaveDashboardCommand{
		UserID: 1,
		OrgID:  1,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 2",
		}),
	})

	u := &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
	}
	role := testutil.SetupRBACRole(t, sql, u)

	type testCase struct {
		name              string
		permissions       map[string][]string
		featureToggle     string
		expectedResources *AccessResources
		expectedErr       error
	}

	testCases := []testCase{
		{
			name: "should have both scopes and all dashboards",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsAll},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedResources: &AccessResources{
				Dashboards:               map[string]int64{dash1.UID: dash1.ID, dash2.UID: dash2.ID},
				CanAccessOrgAnnotations:  true,
				CanAccessDashAnnotations: true,
			},
		},
		{
			name: "should have no dashboards if missing annotation read permission on dashboards and FlagAnnotationPermissionUpdate is enabled",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsAll},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			featureToggle: featuremgmt.FlagAnnotationPermissionUpdate,
			expectedResources: &AccessResources{
				Dashboards:               nil,
				CanAccessOrgAnnotations:  true,
				CanAccessDashAnnotations: true,
			},
		},
		{
			name: "should have dashboard and organization scope and all dashboards if FlagAnnotationPermissionUpdate is enabled",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeOrganization, dashboards.ScopeDashboardsAll},
			},
			featureToggle: featuremgmt.FlagAnnotationPermissionUpdate,
			expectedResources: &AccessResources{
				Dashboards:               map[string]int64{dash1.UID: dash1.ID, dash2.UID: dash2.ID},
				CanAccessOrgAnnotations:  true,
				CanAccessDashAnnotations: true,
			},
		},
		{
			name: "should have dashboard and organization scope and all dashboards if FlagAnnotationPermissionUpdate is enabled and folder based scope is used",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeOrganization, dashboards.ScopeFoldersAll},
			},
			featureToggle: featuremgmt.FlagAnnotationPermissionUpdate,
			expectedResources: &AccessResources{
				Dashboards:               map[string]int64{dash1.UID: dash1.ID, dash2.UID: dash2.ID},
				CanAccessOrgAnnotations:  true,
				CanAccessDashAnnotations: true,
			},
		},
		{
			name: "should have only organization scope and no dashboards",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeOrganization},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedResources: &AccessResources{
				Dashboards:              nil,
				CanAccessOrgAnnotations: true,
			},
		},
		{
			name: "should have only dashboard scope and all dashboards",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedResources: &AccessResources{
				Dashboards:               map[string]int64{dash1.UID: dash1.ID, dash2.UID: dash2.ID},
				CanAccessDashAnnotations: true,
			},
		},
		{
			name: "should have only dashboard scope and all dashboards if FlagAnnotationPermissionUpdate is enabled",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {dashboards.ScopeDashboardsAll},
			},
			featureToggle: featuremgmt.FlagAnnotationPermissionUpdate,
			expectedResources: &AccessResources{
				Dashboards:               map[string]int64{dash1.UID: dash1.ID, dash2.UID: dash2.ID},
				CanAccessOrgAnnotations:  false,
				CanAccessDashAnnotations: true,
			},
		},
		{
			name: "should have only dashboard scope and only dashboard 1",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {fmt.Sprintf("dashboards:uid:%s", dash1.UID)},
			},
			expectedResources: &AccessResources{
				Dashboards:               map[string]int64{dash1.UID: dash1.ID},
				CanAccessDashAnnotations: true,
			},
		},
		{
			name: "should have only dashboard scope and only dashboard 1 if FlagAnnotationPermissionUpdate is enabled",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dash1.UID)},
			},
			featureToggle: featuremgmt.FlagAnnotationPermissionUpdate,
			expectedResources: &AccessResources{
				Dashboards:               map[string]int64{dash1.UID: dash1.ID},
				CanAccessOrgAnnotations:  false,
				CanAccessDashAnnotations: true,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			u.Permissions = map[int64]map[string][]string{1: tc.permissions}
			testutil.SetupRBACPermission(t, sql, role, u)

			authz := NewAuthService(sql, featuremgmt.WithFeatures(tc.featureToggle))

			query := &annotations.ItemQuery{SignedInUser: u}
			resources, err := authz.Authorize(context.Background(), 1, query)
			require.NoError(t, err)

			if tc.expectedResources.Dashboards != nil {
				require.Equal(t, tc.expectedResources.Dashboards, resources.Dashboards)
			}

			require.Equal(t, tc.expectedResources.CanAccessDashAnnotations, resources.CanAccessDashAnnotations)
			require.Equal(t, tc.expectedResources.CanAccessOrgAnnotations, resources.CanAccessOrgAnnotations)

			if tc.expectedErr != nil {
				require.Equal(t, tc.expectedErr, err)
			}
		})
	}
}
