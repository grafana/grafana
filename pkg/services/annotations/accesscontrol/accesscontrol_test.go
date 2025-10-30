package accesscontrol

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/testutil"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardsservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAuthorize(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sql, cfg := db.InitTestDBWithCfg(t)
	folderStore := folderimpl.ProvideDashboardFolderStore(sql)
	fStore := folderimpl.ProvideStore(sql)
	dashStore, err := database.ProvideDashboardStore(sql, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sql))
	require.NoError(t, err)
	ac := actest.FakeAccessControl{ExpectedEvaluate: true}
	folderSvc := folderimpl.ProvideService(
		fStore, ac, bus.ProvideBus(tracing.InitializeTracerForTest()), dashStore, folderStore,
		nil, sql, featuremgmt.WithFeatures(), supportbundlestest.NewFakeBundleService(), nil, cfg, nil, tracing.InitializeTracerForTest(), nil, dualwrite.ProvideTestService(), sort.ProvideService(), apiserver.WithoutRestConfig)
	dashSvc, err := dashboardsservice.ProvideDashboardServiceImpl(cfg, dashStore, folderStore, featuremgmt.WithFeatures(), accesscontrolmock.NewMockedPermissionsService(),
		ac, actest.FakeService{}, folderSvc, nil, client.MockTestRestConfig{}, nil, quotatest.New(false, nil), nil, nil, nil, dualwrite.ProvideTestService(), sort.ProvideService(),
		serverlock.ProvideService(sql, tracing.InitializeTracerForTest()),
		kvstore.NewFakeKVStore())
	require.NoError(t, err)
	dashSvc.RegisterDashboardPermissions(accesscontrolmock.NewMockedPermissionsService())

	u := &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
	}

	dash1, err := dashSvc.SaveDashboard(context.Background(), &dashboards.SaveDashboardDTO{
		User:  u,
		OrgID: 1,
		Dashboard: &dashboards.Dashboard{
			Title: "Dashboard 1",
			Data:  simplejson.New(),
		},
	}, false)
	require.NoError(t, err)

	dash2, err := dashSvc.SaveDashboard(context.Background(), &dashboards.SaveDashboardDTO{
		User:  u,
		OrgID: 1,
		Dashboard: &dashboards.Dashboard{
			Title: "Dashboard 2",
			Data:  simplejson.New(),
		},
	}, false)
	require.NoError(t, err)

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
			authz := NewAuthService(sql, featuremgmt.WithFeatures(tc.featureToggle), dashSvc, cfg)

			query := annotations.ItemQuery{SignedInUser: u, OrgID: 1}
			resources, err := authz.Authorize(context.Background(), query)
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

func TestDashboardsWithVisibleAnnotations(t *testing.T) {
	store := db.InitTestDB(t)

	user := &user.SignedInUser{
		OrgID: 1,
	}

	// Create permission filters
	p1 := permissions.NewAccessControlDashboardPermissionFilter(user, dashboardaccess.PERMISSION_VIEW, searchstore.TypeDashboard, featuremgmt.WithFeatures(), true, store.GetDialect())
	p2 := searchstore.OrgFilter{OrgId: 1}

	// If DashboardUID is provided, it should be added as a filter
	p3 := searchstore.DashboardFilter{UIDs: []string{"uid1"}}

	dashSvc := &dashboards.FakeDashboardService{}

	// First call, without DashboardUID
	queryNoDashboardUID := &dashboards.FindPersistedDashboardsQuery{
		OrgId:        1,
		SignedInUser: user,
		Type:         "dash-db",
		Limit:        int64(100),
		Page:         int64(1),
		Filters: []any{
			p1,
			p2,
		},
	}
	dashSvc.On("SearchDashboards", mock.Anything, queryNoDashboardUID).Return(model.HitList{
		&model.Hit{UID: "uid1", ID: 101},
		&model.Hit{UID: "uid2", ID: 102},
	}, nil)

	// Second call, with DashboardUID filter
	queryWithDashboardUID := &dashboards.FindPersistedDashboardsQuery{
		OrgId:        1,
		SignedInUser: user,
		Type:         "dash-db",
		Limit:        int64(100),
		Page:         int64(1),
		Filters: []any{
			p1,
			p2,
			// This filter should be added on second call
			p3,
		},
		DashboardUIDs: []string{"uid1"},
	}

	dashSvc.On("SearchDashboards", mock.Anything, queryWithDashboardUID).Return(model.HitList{
		&model.Hit{UID: "uid1", ID: 101},
	}, nil)

	// Create auth service
	authz := &AuthService{
		db:                        store,
		features:                  featuremgmt.WithFeatures(),
		dashSvc:                   dashSvc,
		searchDashboardsPageLimit: 100,
	}

	// First call without DashboardUID
	result, err := authz.dashboardsWithVisibleAnnotations(context.Background(), annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        1,
		Page:         1,
	})
	assert.NoError(t, err)
	// Should return two dashboards
	assert.Equal(t, map[string]int64{"uid1": 101, "uid2": 102}, result)
	// Ensure SearchDashboards was called with correct query
	dashSvc.AssertCalled(t, "SearchDashboards", mock.Anything, queryNoDashboardUID)

	// Second call with DashboardUID
	result, err = authz.dashboardsWithVisibleAnnotations(context.Background(), annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        1,
		Page:         1,
		DashboardUID: "uid1",
	})
	assert.NoError(t, err)
	// Should only return one dashboard
	assert.Equal(t, map[string]int64{"uid1": 101}, result)
	// Ensure SearchDashboards was called with correct query (including DashboardUID filter)
	dashSvc.AssertCalled(t, "SearchDashboards", mock.Anything, queryWithDashboardUID)
}
