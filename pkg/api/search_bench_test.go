package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	Lvl0FolderNum    = 50
	Lvl1FolderNum    = 10
	Lvl2FolderNum    = 10
	RootDashboardNum = 5000
	Lvl0DashboardNum = 30
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
			expectedLen: withLimit(Lvl0FolderNum),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "list all dashboards with split scopes enabled",
			url:         "/api/search?type=dash-db&limit=1000",
			expectedLen: withLimit(allDashboards),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "search specific dashboard with split scopes enabled",
			url:         "/api/search?type=dash-db&query=dashboard_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "search several dashboards with split scopes enabled",
			url:         "/api/search?type=dash-db&query=dashboard_0_",
			expectedLen: withLimit(Lvl0DashboardNum),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "search dashboards and folder with split scopes enabled",
			url:         "/api/search",
			expectedLen: withLimit(allDashboards + allFolders),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "search dashboards in general folder with split scopes enabled",
			url:         "/api/search?limit=1000&sort=name_sort&type=dash-db&folderUIDs=general",
			expectedLen: withLimit(RootDashboardNum),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagSplitScopes),
		},
		{
			desc:        "get all folders with remove sub-query toggle",
			url:         "/api/folders?limit=1000",
			expectedLen: withLimit(Lvl0FolderNum),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "list all dashboards with remove sub-query toggle",
			url:         "/api/search?type=dash-db&limit=1000",
			expectedLen: withLimit(allDashboards),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "search specific dashboard with remove sub-query toggle",
			url:         "/api/search?type=dash-db&query=dashboard_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "search several dashboards with remove sub-query toggle",
			url:         "/api/search?type=dash-db&query=dashboard_0_",
			expectedLen: withLimit(Lvl0DashboardNum),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "search dashboards and folder with remove sub-query toggle",
			url:         "/api/search",
			expectedLen: withLimit(allDashboards + allFolders),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "search dashboards in general folder remove sub-query toggle",
			url:         "/api/search?limit=1000&sort=name_sort&type=dash-db&folderUIDs=general",
			expectedLen: withLimit(allDashboards + allFolders),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "get all folders without toggles",
			url:         "/api/folders?limit=1000",
			expectedLen: withLimit(Lvl0FolderNum),
			features:    featuremgmt.WithFeatures(),
		},
		{
			desc:        "list all dashboards without toggles",
			url:         "/api/search?type=dash-db&limit=1000",
			expectedLen: withLimit(allDashboards),
			features:    featuremgmt.WithFeatures(),
		},
		{
			desc:        "search specific dashboard without toggles",
			url:         "/api/search?type=dash-db&query=dashboard_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(),
		},
		{
			desc:        "search several dashboards without toggles",
			url:         "/api/search?type=dash-db&query=dashboard_0_",
			expectedLen: withLimit(Lvl0DashboardNum),
			features:    featuremgmt.WithFeatures(),
		},
		{
			desc:        "search dashboards and folder without toggles",
			url:         "/api/search",
			expectedLen: withLimit(allDashboards + allFolders),
			features:    featuremgmt.WithFeatures(),
		},
		{
			desc:        "search dashboards in general folder without toggles",
			url:         "/api/search?limit=1000&sort=name_sort&type=dash-db&folderUIDs=general",
			expectedLen: withLimit(allDashboards + allFolders),
			features:    featuremgmt.WithFeatures(),
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
				var resp []dtos.FolderSearchHit
				err := json.Unmarshal(rec.Body.Bytes(), &resp)
				require.NoError(b, err)
				assert.Len(b, resp, bm.expectedLen)
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
		OrgID:          orgID,
		Login:          "user0",
		Password:       "grafana",
		DefaultOrgRole: "Viewer",
	})
	require.NoError(b, err)
	require.NotZero(b, u.ID)

	signedInUser := user.SignedInUser{UserID: u.ID, OrgID: orgID, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{orgID: {}}}

	now := time.Now()
	managedViewerRole := accesscontrol.Role{
		ID:          int64(1),
		OrgID:       orgID,
		Version:     1,
		UID:         "managed_viewer_role",
		Name:        "managed:builtins:viewer:permissions",
		DisplayName: "managed_viewer_role",
		Updated:     now,
		Created:     now,
	}

	managedViewerRoleAssignment := accesscontrol.UserRole{
		OrgID:   orgID,
		RoleID:  managedViewerRole.ID,
		UserID:  u.ID,
		Created: now,
	}

	managedEditorRole := accesscontrol.Role{
		ID:          int64(2),
		OrgID:       orgID,
		Version:     1,
		UID:         "managed_editor_role",
		Name:        "managed:builtins:editor:permissions",
		DisplayName: "managed_editor_role",
		Updated:     now,
		Created:     now,
	}

	managedEditorRoleAssignment := accesscontrol.UserRole{
		OrgID:   orgID,
		RoleID:  managedEditorRole.ID,
		UserID:  u.ID,
		Created: now,
	}

	managedAdminRole := accesscontrol.Role{
		ID:          int64(3),
		OrgID:       orgID,
		Version:     1,
		UID:         "managed_admin_role",
		Name:        "managed:builtins:admin:permissions",
		DisplayName: "managed_admin_role",
		Updated:     now,
		Created:     now,
	}

	managedAdminRoleAssignment := accesscontrol.UserRole{
		OrgID:   orgID,
		RoleID:  managedAdminRole.ID,
		UserID:  u.ID,
		Created: now,
	}

	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err = sess.InsertMulti(&[]accesscontrol.Role{managedViewerRole, managedEditorRole, managedAdminRole})
		require.NoError(b, err)

		_, err = sess.InsertMulti(&[]accesscontrol.UserRole{managedViewerRoleAssignment, managedEditorRoleAssignment, managedAdminRoleAssignment})
		require.NoError(b, err)
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

		// only add permissions to viewer role half of the time
		if i%2 == 0 {
			permissions = append(permissions, dashboardViewPermissions(managedViewerRole.ID, dash.UID)...)
		}
		permissions = append(permissions, dashboardEditPermissions(managedEditorRole.ID, dash.UID)...)
		permissions = append(permissions, dashboardAdminPermissions(managedAdminRole.ID, dash.UID)...)
	}

	for i := 0; i < Lvl0FolderNum; i++ {
		f0, d := createFolder(orgID, generateID(IDs), fmt.Sprintf("folder%d", i), nil)
		folders = append(folders, f0)
		dashs = append(dashs, d)

		// only add permissions to viewer role half of the time
		if i%2 == 0 {
			permissions = append(permissions, folderViewPermissions(managedViewerRole.ID, f0.UID)...)
		}
		permissions = append(permissions, folderEditPermissions(managedEditorRole.ID, f0.UID)...)
		permissions = append(permissions, folderAdminPermissions(managedAdminRole.ID, f0.UID)...)

		for j := 0; j < Lvl0DashboardNum; j++ {
			str := fmt.Sprintf("dashboard_%d_%d", i, j)
			dashID := generateID(IDs)
			dash := createDashboard(orgID, dashID, str, f0.ID)
			dashs = append(dashs, dash)
		}

		for j := 0; j < Lvl1FolderNum; j++ {
			f1, d1 := createFolder(orgID, generateID(IDs), fmt.Sprintf("folder%d_%d", i, j), &f0.UID)
			folders = append(folders, f1)
			dashs = append(dashs, d1)

			for k := 0; k < Lvl1DashboardNum; k++ {
				str := fmt.Sprintf("dashboard_%d_%d_%d", i, j, k)
				dashID := generateID(IDs)
				dash := createDashboard(orgID, dashID, str, f1.ID)
				dashs = append(dashs, dash)
			}

			for k := 0; k < Lvl2FolderNum; k++ {
				f2, d2 := createFolder(orgID, generateID(IDs), fmt.Sprintf("folder%d_%d_%d", i, j, k), &f1.UID)
				folders = append(folders, f2)
				dashs = append(dashs, d2)

				for l := 0; l < Lvl2DashboardNum; l++ {
					str := fmt.Sprintf("dashboard_%d_%d_%d_%d", i, j, k, l)
					dashID := generateID(IDs)
					dash := createDashboard(orgID, dashID, str, f2.ID)
					dashs = append(dashs, dash)
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

func dashboardViewPermissions(roleID int64, uid string) []accesscontrol.Permission {
	return createPermissions(
		roleID,
		dashboards.ScopeDashboardsProvider.GetResourceScopeUID(uid),
		dashboards.ActionDashboardsRead,
	)
}

func dashboardEditPermissions(roleID int64, uid string) []accesscontrol.Permission {
	return createPermissions(
		roleID,
		dashboards.ScopeDashboardsProvider.GetResourceScopeUID(uid),
		dashboards.ActionDashboardsRead,
		dashboards.ActionDashboardsWrite,
		dashboards.ActionDashboardsDelete,
	)
}

func dashboardAdminPermissions(roleID int64, uid string) []accesscontrol.Permission {
	return createPermissions(
		roleID,
		dashboards.ScopeDashboardsProvider.GetResourceScopeUID(uid),
		dashboards.ActionDashboardsRead,
		dashboards.ActionDashboardsWrite,
		dashboards.ActionDashboardsDelete,
		dashboards.ActionDashboardsPermissionsRead,
		dashboards.ActionDashboardsPermissionsWrite,
	)
}

func folderViewPermissions(roleID int64, uid string) []accesscontrol.Permission {
	return createPermissions(
		roleID,
		dashboards.ScopeFoldersProvider.GetResourceScopeUID(uid),
		dashboards.ActionFoldersRead,
		dashboards.ActionDashboardsRead,
		accesscontrol.ActionAlertingRuleRead,
	)
}

func folderEditPermissions(roleID int64, uid string) []accesscontrol.Permission {
	return createPermissions(
		roleID,
		dashboards.ScopeFoldersProvider.GetResourceScopeUID(uid),
		dashboards.ActionFoldersRead,
		dashboards.ActionFoldersWrite,
		dashboards.ActionFoldersDelete,
		dashboards.ActionDashboardsRead,
		dashboards.ActionDashboardsCreate,
		dashboards.ActionDashboardsWrite,
		accesscontrol.ActionAlertingRuleRead,
		accesscontrol.ActionAlertingRuleCreate,
		accesscontrol.ActionAlertingRuleUpdate,
	)
}

func folderAdminPermissions(roleID int64, uid string) []accesscontrol.Permission {
	return createPermissions(
		roleID,
		dashboards.ScopeFoldersProvider.GetResourceScopeUID(uid),
		dashboards.ActionFoldersRead,
		dashboards.ActionFoldersWrite,
		dashboards.ActionFoldersDelete,
		dashboards.ActionDashboardsRead,
		dashboards.ActionDashboardsCreate,
		dashboards.ActionDashboardsWrite,
		accesscontrol.ActionAlertingRuleRead,
		accesscontrol.ActionAlertingRuleCreate,
		accesscontrol.ActionAlertingRuleUpdate,
		accesscontrol.ActionAlertingRuleDelete,
		dashboards.ActionFoldersPermissionsRead,
		dashboards.ActionFoldersPermissionsWrite,
		dashboards.ActionDashboardsPermissionsRead,
		dashboards.ActionDashboardsPermissionsWrite,
	)
}

func createPermissions(roleID int64, scope string, actions ...string) []accesscontrol.Permission {
	permissions := make([]accesscontrol.Permission, 0, len(actions))

	now := time.Now()
	for _, a := range actions {
		p := accesscontrol.Permission{
			RoleID:  roleID,
			Action:  a,
			Scope:   scope,
			Updated: now,
			Created: now,
		}
		p.Kind, p.Attribute, p.Identifier = p.SplitScope()
		permissions = append(permissions, p)
	}

	return permissions
}
