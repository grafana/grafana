package api

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/require"
)

var (
	Lvl0FolderNum    = 50
	Lvl1FolderNum    = 10
	Lvl2FolderNum    = 10
	RootDashboardNum = 10000
	Lvl0DashboardNum = 1000
	Lvl1DashboardNum = 10
	Lvl2DashboardNum = 10
)

func BenchmarkSearch(b *testing.B) {
	start := time.Now()
	b.Log("setup start")
	sc := setupTestDB(b)
	b.Log("setup time:", time.Since(start))

	allDashboards := RootDashboardNum + Lvl0FolderNum*Lvl0DashboardNum + Lvl0FolderNum*Lvl1FolderNum*Lvl1DashboardNum + Lvl0FolderNum*Lvl1FolderNum*Lvl2FolderNum*Lvl2DashboardNum
	allFolders := Lvl0FolderNum + Lvl0FolderNum*Lvl1FolderNum + Lvl0FolderNum*Lvl1FolderNum*Lvl2FolderNum

	b.Logf("DB type: %s", sc.db.GetDBType())
	b.Logf("Total number of folders: %d", allFolders)
	b.Logf("Total number of dashboards: %d", allDashboards)

	// the maximum number of dashboards that can be returned by the search API
	// otherwise the handler fails with 422 status code
	const limit = 1000
	withLimit := func(res int) int {
		if res > limit {
			return limit
		}
		return res
	}

	benchmarks := []struct {
		desc        string
		url         string
		expectedLen int
		features    *featuremgmt.FeatureManager
	}{
		{
			desc:        "get all folders with split scopes enabled",
			url:         "/api/folders?limit=1000",
			expectedLen: withLimit(allFolders),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "list all dashboards with split scopes enabled",
			url:         "/api/search?type=dash-db&limit=1000",
			expectedLen: withLimit(allDashboards),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "list all dashboards with split scopes enabled 2",
			url:         "/api/search?type=dash-db&limit=1000",
			expectedLen: withLimit(allDashboards),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "search specific dashboard with split scopes enabled",
			url:         "/api/search?type=dash-db&query=dashboard_0_0_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "search several dashboards with split scopes enabled",
			url:         "/api/search?type=dash-db&query=dashboard_0_0_0",
			expectedLen: withLimit(Lvl2DashboardNum + 1),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "search dashboards and folder with split scopes enabled",
			url:         "/api/search?query=dash",
			expectedLen: withLimit(allDashboards + allFolders),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "get all folders with removed sub-query enabled",
			url:         "/api/folders?limit=1000",
			expectedLen: withLimit(allFolders),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "list all dashboards with removed sub-query enabled",
			url:         "/api/search?type=dash-db&limit=1000",
			expectedLen: withLimit(allDashboards),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "search specific dashboard with removed sub-query enabled",
			url:         "/api/search?type=dash-db&query=dashboard_0_0_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "search several dashboards with removed sub-query enabled",
			url:         "/api/search?type=dash-db&query=dashboard_0_0_0",
			expectedLen: withLimit(Lvl2DashboardNum + 1),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "search dashboards and folder with split scopes enabled",
			url:         "/api/search",
			expectedLen: withLimit(allDashboards + allFolders),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
	}
	for _, bm := range benchmarks {
		b.Run(bm.desc, func(b *testing.B) {
			m := setupServer(b, sc, bm.features)
			req := httptest.NewRequest(http.MethodGet, bm.url, nil)
			req = webtest.RequestWithSignedInUser(req, sc.signedInUser)
			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				rec := httptest.NewRecorder()
				m.ServeHTTP(rec, req)
				require.Equal(b, 200, rec.Code)
			}
		})
	}
}

func setupTestDB(b testing.TB) benchScenario {
	b.Helper()
	db := sqlstore.InitTestDB(b)
	IDs := map[int64]struct{}{}

	quotaService := quotatest.New(false, nil)
	cfg := setting.NewCfg()

	teamSvc := teamimpl.ProvideService(db, cfg)
	orgService, err := orgimpl.ProvideService(db, cfg, quotaService)
	require.NoError(b, err)

	cache := localcache.ProvideService()
	userSvc, err := userimpl.ProvideService(db, orgService, cfg, teamSvc, cache, &quotatest.FakeQuotaService{}, bundleregistry.ProvideService())
	require.NoError(b, err)

	origNewGuardian := guardian.New
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true, CanViewValue: true})

	b.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	var orgID int64 = 1
	u, err := userSvc.Create(context.Background(), &user.CreateUserCommand{
		OrgID:    orgID,
		Login:    "user0",
		Password: "grafana",
	})
	require.NoError(b, err)
	require.NotZero(b, u.ID)

	signedInUser := user.SignedInUser{UserID: u.ID, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {dashboards.ActionFoldersCreate: {}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
	}}

	now := time.Now()
	signedInUserRole := accesscontrol.Role{
		ID:          int64(1),
		OrgID:       orgID,
		Version:     1,
		UID:         "role_1",
		Name:        "signed_in_user_role",
		DisplayName: "signed_in_user_role",
		Group:       "",
		Description: "signed in user role",
		Hidden:      false,
		Updated:     now,
		Created:     now,
	}

	signedInUserRoleAssignment := accesscontrol.UserRole{
		ID:      int64(1),
		OrgID:   orgID,
		RoleID:  signedInUserRole.ID,
		UserID:  u.ID,
		Created: now,
	}

	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err = sess.Insert(signedInUserRole)
		require.NoError(b, err)

		_, err = sess.Insert(signedInUserRoleAssignment)
		return err
	})
	require.NoError(b, err)

	allDashboards := RootDashboardNum + Lvl0FolderNum*Lvl0DashboardNum + Lvl0FolderNum*Lvl1FolderNum*Lvl1DashboardNum + Lvl0FolderNum*Lvl1FolderNum*Lvl2FolderNum*Lvl2DashboardNum
	allFolders := Lvl0FolderNum + Lvl0FolderNum*Lvl1FolderNum + Lvl0FolderNum*Lvl1FolderNum*Lvl2FolderNum
	folders := make([]*f, 0, allFolders)
	dashs := make([]*dashboards.Dashboard, 0, allDashboards)
	permissions := make([]accesscontrol.Permission, 0, allFolders*2+allDashboards)

	for i := 0; i < RootDashboardNum; i++ {
		str := fmt.Sprintf("dashboard_%d", i)
		dashID := generateID(IDs)
		dash := createDashboard(orgID, dashID, str, 0)
		dashs = append(dashs, dash)
		permissions = append(permissions, createPermission(signedInUserRole.ID, dashboards.ActionDashboardsRead, "dashboards", dash.UID))
	}

	for i := 0; i < Lvl0FolderNum; i++ {
		f0, d := createFolder(orgID, generateID(IDs), fmt.Sprintf("folder%d", i), nil)
		folders = append(folders, f0)
		dashs = append(dashs, d)
		permissions = append(permissions, createPermission(signedInUserRole.ID, dashboards.ActionFoldersRead, "folders", f0.UID))
		permissions = append(permissions, createPermission(signedInUserRole.ID, dashboards.ActionDashboardsRead, "folders", f0.UID))

		for j := 0; j < Lvl0DashboardNum; j++ {
			str := fmt.Sprintf("dashboard_%d_%d", i, j)
			dashID := generateID(IDs)
			dash := createDashboard(orgID, dashID, str, f0.ID)
			dashs = append(dashs, dash)
			permissions = append(permissions, createPermission(signedInUserRole.ID, dashboards.ActionDashboardsRead, "dashboards", dash.UID))
		}

		for j := 0; j < Lvl1FolderNum; j++ {
			f1, d1 := createFolder(orgID, generateID(IDs), fmt.Sprintf("folder%d_%d", i, j), &f0.UID)
			folders = append(folders, f1)
			dashs = append(dashs, d1)
			permissions = append(permissions, createPermission(signedInUserRole.ID, dashboards.ActionFoldersRead, "folders", f1.UID))
			permissions = append(permissions, createPermission(signedInUserRole.ID, dashboards.ActionDashboardsRead, "folders", f1.UID))

			for k := 0; k < Lvl1DashboardNum; k++ {
				str := fmt.Sprintf("dashboard_%d_%d_%d", i, j, k)
				dashID := generateID(IDs)
				dash := createDashboard(orgID, dashID, str, f1.ID)
				dashs = append(dashs, dash)
				permissions = append(permissions, createPermission(signedInUserRole.ID, dashboards.ActionDashboardsRead, "dashboards", dash.UID))
			}

			for k := 0; k < Lvl2FolderNum; k++ {
				f2, d2 := createFolder(orgID, generateID(IDs), fmt.Sprintf("folder%d_%d_%d", i, j, k), &f1.UID)
				folders = append(folders, f2)
				dashs = append(dashs, d2)
				permissions = append(permissions, createPermission(signedInUserRole.ID, dashboards.ActionFoldersRead, "folders", f2.UID))
				permissions = append(permissions, createPermission(signedInUserRole.ID, dashboards.ActionDashboardsRead, "folders", f2.UID))

				for l := 0; l < Lvl2DashboardNum; l++ {
					str := fmt.Sprintf("dashboard_%d_%d_%d_%d", i, j, k, l)
					dashID := generateID(IDs)
					dash := createDashboard(orgID, dashID, str, f2.ID)
					dashs = append(dashs, dash)
					permissions = append(permissions, createPermission(signedInUserRole.ID, dashboards.ActionDashboardsRead, "dashboards", dash.UID))
				}
			}
		}
	}

	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		opts := sqlstore.NativeSettingsForDialect(db.GetDialect())

		_, err := sess.BulkInsert("folder", folders, opts)
		require.NoError(b, err)

		_, err = sess.BulkInsert("dashboard", dashs, opts)
		require.NoError(b, err)

		_, err = sess.BulkInsert("permission", permissions, opts)
		return err
	})
	require.NoError(b, err)
	return benchScenario{
		db:           db,
		cfg:          cfg,
		signedInUser: &signedInUser,
		teamSvc:      teamSvc,
		userSvc:      userSvc,
	}
}

func createFolder(orgID int64, id int64, uid string, parentUID *string) (*f, *dashboards.Dashboard) {
	now := time.Now()
	title := uid
	f := &f{
		OrgID:     orgID,
		UID:       uid,
		Title:     title,
		ID:        id,
		Created:   now,
		Updated:   now,
		ParentUID: parentUID,
	}

	d := &dashboards.Dashboard{
		ID:       id,
		OrgID:    orgID,
		UID:      uid,
		Version:  1,
		Title:    title,
		Data:     simplejson.NewFromAny(map[string]interface{}{"schemaVersion": 17, "title": title, "uid": uid, "version": 1}),
		IsFolder: true,
		Created:  now,
		Updated:  now,
	}
	return f, d
}

func createDashboard(orgID int64, id int64, uid string, parentID int64) *dashboards.Dashboard {
	now := time.Now()

	d := &dashboards.Dashboard{
		ID:       id,
		OrgID:    orgID,
		UID:      uid,
		Version:  1,
		Title:    uid,
		Data:     simplejson.New(),
		FolderID: parentID,
		IsFolder: false,
		Created:  now,
		Updated:  now,
	}
	return d
}

func createPermission(roleID int64, action string, kind string, uid string) accesscontrol.Permission {
	scope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(uid)
	if kind == "folders" {
		scope = dashboards.ScopeFoldersProvider.GetResourceScopeUID(uid)
	}
	now := time.Now()
	return accesscontrol.Permission{
		RoleID:     roleID,
		Action:     action,
		Scope:      scope,
		Updated:    now,
		Created:    now,
		Kind:       kind,
		Attribute:  "uid",
		Identifier: uid,
	}
}
