package accesscontrol

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/testutil"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

var (
	dashScopeType = annotations.Dashboard.String()
	orgScopeType  = annotations.Organization.String()
)

func TestIntegrationAuthorize(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sql := db.InitTestDB(t)

	authz := NewAuthService(sql, featuremgmt.WithFeatures())

	dash1 := testutil.CreateDashboard(t, sql, featuremgmt.WithFeatures(), dashboards.SaveDashboardCommand{
		UserID: 1,
		OrgID:  1,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 1",
		}),
	})

	dash2 := testutil.CreateDashboard(t, sql, featuremgmt.WithFeatures(), dashboards.SaveDashboardCommand{
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
				Dashboards: map[string]int64{dash1.UID: dash1.ID, dash2.UID: dash2.ID},
				ScopeTypes: map[any]struct{}{dashScopeType: {}, orgScopeType: {}},
			},
		},
		{
			name: "should have only organization scope and no dashboards",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeOrganization},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedResources: &AccessResources{
				Dashboards: nil,
				ScopeTypes: map[any]struct{}{orgScopeType: {}},
			},
		},
		{
			name: "should have only dashboard scope and all dashboards",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedResources: &AccessResources{
				Dashboards: map[string]int64{dash1.UID: dash1.ID, dash2.UID: dash2.ID},
				ScopeTypes: map[any]struct{}{dashScopeType: {}},
			},
		},
		{
			name: "should have only dashboard scope and only dashboard 1",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {fmt.Sprintf("dashboards:uid:%s", dash1.UID)},
			},
			expectedResources: &AccessResources{
				Dashboards: map[string]int64{dash1.UID: dash1.ID},
				ScopeTypes: map[any]struct{}{dashScopeType: {}},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			u.Permissions = map[int64]map[string][]string{1: tc.permissions}
			testutil.SetupRBACPermission(t, sql, role, u)

			resources, err := authz.Authorize(context.Background(), 1, u)
			require.NoError(t, err)

			if tc.expectedResources.Dashboards != nil {
				require.Equal(t, tc.expectedResources.Dashboards, resources.Dashboards)
			}

			if tc.expectedResources.ScopeTypes != nil {
				require.Equal(t, tc.expectedResources.ScopeTypes, resources.ScopeTypes)
			}

			if tc.expectedErr != nil {
				require.Equal(t, tc.expectedErr, err)
			}
		})
	}
}
