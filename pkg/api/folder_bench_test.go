package api

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acdb "github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/star/startest"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

const (
	LEVEL0_FOLDER_NUM    = 300
	LEVEL1_FOLDER_NUM    = 30
	LEVEL2_FOLDER_NUM    = 5
	LEVEL0_DASHBOARD_NUM = 300
	LEVEL1_DASHBOARD_NUM = 30
	LEVEL2_DASHBOARD_NUM = 5
	TEAM_NUM             = 50
	TEAM_MEMBER_NUM      = 5

	MAXIMUM_INT_POSTGRES = 2147483647
)

type benchScenario struct {
	db db.DB
	// signedInUser is the user that is signed in to the server
	cfg          *setting.Cfg
	signedInUser *user.SignedInUser
	teamSvc      team.Service
	userSvc      user.Service
}

func BenchmarkFolderListAndSearch(b *testing.B) {
	start := time.Now()
	b.Log("setup start")
	sc := setupDB(b)
	b.Log("setup time:", time.Since(start))

	all := LEVEL0_FOLDER_NUM*LEVEL0_DASHBOARD_NUM + LEVEL0_FOLDER_NUM*LEVEL1_FOLDER_NUM*LEVEL1_DASHBOARD_NUM + LEVEL0_FOLDER_NUM*LEVEL1_FOLDER_NUM*LEVEL2_FOLDER_NUM*LEVEL2_DASHBOARD_NUM

	// the maximum number of dashboards that can be returned by the search API
	// otherwise the handler fails with 422 status code
	const limit = 5000
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
		features    featuremgmt.FeatureToggles
	}{
		{
			desc:        "impl=default nested_folders=on get root folders",
			url:         "/api/folders",
			expectedLen: LEVEL0_FOLDER_NUM + 1, // for shared with me folder
			features:    featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
		},
		{
			desc:        "impl=default nested_folders=on get subfolders",
			url:         "/api/folders?parentUid=folder0",
			expectedLen: LEVEL1_FOLDER_NUM,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
		},
		{
			desc:        "impl=default nested_folders=on list all inherited dashboards",
			url:         "/api/search?type=dash-db&limit=5000",
			expectedLen: withLimit(all),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
		},
		{
			desc:        "impl=permissionsFilterRemoveSubquery nested_folders=on list all inherited dashboards",
			url:         "/api/search?type=dash-db&limit=5000",
			expectedLen: withLimit(all),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders, featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "impl=default nested_folders=on search for pattern",
			url:         "/api/search?type=dash-db&query=dashboard_0_0&limit=5000",
			expectedLen: withLimit(1 + LEVEL1_DASHBOARD_NUM + LEVEL2_FOLDER_NUM*LEVEL2_DASHBOARD_NUM),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
		},
		{
			desc:        "impl=permissionsFilterRemoveSubquery nested_folders=on search for pattern",
			url:         "/api/search?type=dash-db&query=dashboard_0_0&limit=5000",
			expectedLen: withLimit(1 + LEVEL1_DASHBOARD_NUM + LEVEL2_FOLDER_NUM*LEVEL2_DASHBOARD_NUM),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders, featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "impl=default nested_folders=on search for specific dashboard",
			url:         "/api/search?type=dash-db&query=dashboard_0_0_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
		},
		{
			desc:        "impl=permissionsFilterRemoveSubquery nested_folders=on search for specific dashboard",
			url:         "/api/search?type=dash-db&query=dashboard_0_0_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders, featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "impl=default nested_folders=off get root folders",
			url:         "/api/folders?limit=5000",
			expectedLen: withLimit(LEVEL0_FOLDER_NUM),
			features:    featuremgmt.WithFeatures(),
		},
		{
			desc:        "impl=default nested_folders=off list all dashboards",
			url:         "/api/search?type=dash-db&limit=5000",
			expectedLen: withLimit(LEVEL0_FOLDER_NUM * LEVEL0_DASHBOARD_NUM),
			features:    featuremgmt.WithFeatures(),
		},
		{
			desc:        "impl=permissionsFilterRemoveSubquery nested_folders=off list all dashboards",
			url:         "/api/search?type=dash-db&limit=5000",
			expectedLen: withLimit(LEVEL0_FOLDER_NUM * LEVEL0_DASHBOARD_NUM),
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "impl=default nested_folders=off search specific dashboard",
			url:         "/api/search?type=dash-db&query=dashboard_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(),
		},
		{
			desc:        "impl=permissionsFilterRemoveSubquery nested_folders=off search specific dashboard",
			url:         "/api/search?type=dash-db&query=dashboard_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
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

func setupDB(b testing.TB) benchScenario {
	b.Helper()
	db, cfg := sqlstore.InitTestDB(b)
	IDs := map[int64]struct{}{}

	opts := sqlstore.NativeSettingsForDialect(db.GetDialect())

	quotaService := quotatest.New(false, nil)

	teamSvc, err := teamimpl.ProvideService(db, cfg, tracing.InitializeTracerForTest())
	require.NoError(b, err)
	orgService, err := orgimpl.ProvideService(db, cfg, quotaService)
	require.NoError(b, err)

	cache := localcache.ProvideService()
	userSvc, err := userimpl.ProvideService(
		db, orgService, cfg, teamSvc, cache, tracing.InitializeTracerForTest(),
		&quotatest.FakeQuotaService{}, bundleregistry.ProvideService(),
	)
	require.NoError(b, err)

	var orgID int64 = 1

	userIDs := make([]int64, 0, TEAM_MEMBER_NUM)
	for i := 0; i < TEAM_MEMBER_NUM; i++ {
		u, err := userSvc.Create(context.Background(), &user.CreateUserCommand{
			OrgID: orgID,
			Login: fmt.Sprintf("user%d", i),
		})
		require.NoError(b, err)
		require.NotZero(b, u.ID)
		userIDs = append(userIDs, u.ID)
	}

	signedInUser := user.SignedInUser{UserID: userIDs[0], OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {dashboards.ActionFoldersCreate: {}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
	}}

	now := time.Now()
	roles := make([]accesscontrol.Role, 0, TEAM_NUM)
	teams := make([]team.Team, 0, TEAM_NUM)
	teamMembers := make([]team.TeamMember, 0, TEAM_MEMBER_NUM)
	teamRoles := make([]accesscontrol.TeamRole, 0, TEAM_NUM)
	for i := 1; i < TEAM_NUM+1; i++ {
		teamID := int64(i)
		teams = append(teams, team.Team{
			UID:     fmt.Sprintf("team%d", i),
			ID:      teamID,
			Name:    fmt.Sprintf("team%d", i),
			OrgID:   orgID,
			Created: now,
			Updated: now,
		})
		signedInUser.Teams = append(signedInUser.Teams, teamID)

		for _, userID := range userIDs {
			teamMembers = append(teamMembers, team.TeamMember{
				UserID:     userID,
				TeamID:     teamID,
				OrgID:      orgID,
				Permission: team.PermissionTypeMember,
				Created:    now,
				Updated:    now,
			})
		}

		name := fmt.Sprintf("managed_team_role_%d", i)
		roles = append(roles, accesscontrol.Role{
			ID:      int64(i),
			UID:     name,
			OrgID:   orgID,
			Name:    name,
			Updated: now,
			Created: now,
		})

		teamRoles = append(teamRoles, accesscontrol.TeamRole{
			RoleID:  int64(i),
			OrgID:   orgID,
			TeamID:  teamID,
			Created: now,
		})
	}
	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.BulkInsert("team", teams, opts)
		require.NoError(b, err)

		_, err = sess.BulkInsert("team_member", teamMembers, opts)
		require.NoError(b, err)

		_, err = sess.BulkInsert("role", roles, opts)
		require.NoError(b, err)

		_, err = sess.BulkInsert("team_role", teamRoles, opts)
		return err
	})
	require.NoError(b, err)

	foldersCap := LEVEL0_FOLDER_NUM + LEVEL0_FOLDER_NUM*LEVEL1_FOLDER_NUM + LEVEL0_FOLDER_NUM*LEVEL1_FOLDER_NUM*LEVEL2_FOLDER_NUM
	folders := make([]*f, 0, foldersCap)
	dashsCap := LEVEL0_FOLDER_NUM * LEVEL1_FOLDER_NUM * LEVEL2_FOLDER_NUM * LEVEL2_DASHBOARD_NUM
	dashs := make([]*dashboards.Dashboard, 0, foldersCap+dashsCap)
	dashTags := make([]*dashboardTag, 0, dashsCap)
	permissions := make([]accesscontrol.Permission, 0, foldersCap*2)
	for i := 0; i < LEVEL0_FOLDER_NUM; i++ {
		f0, d := addFolder(orgID, generateID(IDs), fmt.Sprintf("folder%d", i), nil)
		folders = append(folders, f0)
		dashs = append(dashs, d)

		roleID := int64(i%TEAM_NUM + 1)
		permissions = append(permissions, accesscontrol.Permission{
			RoleID:  roleID,
			Action:  dashboards.ActionFoldersRead,
			Scope:   dashboards.ScopeFoldersProvider.GetResourceScopeUID(f0.UID),
			Updated: now,
			Created: now,
		},
			accesscontrol.Permission{
				RoleID:  roleID,
				Action:  dashboards.ActionDashboardsRead,
				Scope:   dashboards.ScopeFoldersProvider.GetResourceScopeUID(f0.UID),
				Updated: now,
				Created: now,
			},
		)
		signedInUser.Permissions[orgID][dashboards.ActionFoldersRead] = append(signedInUser.Permissions[orgID][dashboards.ActionFoldersRead], dashboards.ScopeFoldersProvider.GetResourceScopeUID(f0.UID))
		signedInUser.Permissions[orgID][dashboards.ActionDashboardsRead] = append(signedInUser.Permissions[orgID][dashboards.ActionDashboardsRead], dashboards.ScopeFoldersProvider.GetResourceScopeUID(f0.UID))

		for j := 0; j < LEVEL0_DASHBOARD_NUM; j++ {
			str := fmt.Sprintf("dashboard_%d_%d", i, j)
			dashID := generateID(IDs)
			dashs = append(dashs, &dashboards.Dashboard{
				ID:        dashID,
				OrgID:     signedInUser.OrgID,
				IsFolder:  false,
				UID:       str,
				FolderID:  f0.ID,
				FolderUID: f0.UID,
				Slug:      str,
				Title:     str,
				Data:      simplejson.New(),
				Created:   now,
				Updated:   now,
			})

			dashTags = append(dashTags, &dashboardTag{
				DashboardID: dashID,
				Term:        fmt.Sprintf("tag%d", j),
			})
		}

		for j := 0; j < LEVEL1_FOLDER_NUM; j++ {
			f1, d1 := addFolder(orgID, generateID(IDs), fmt.Sprintf("folder%d_%d", i, j), &f0.UID)
			folders = append(folders, f1)
			dashs = append(dashs, d1)

			for k := 0; k < LEVEL1_DASHBOARD_NUM; k++ {
				str := fmt.Sprintf("dashboard_%d_%d_%d", i, j, k)
				dashID := generateID(IDs)
				dashs = append(dashs, &dashboards.Dashboard{
					ID:        dashID,
					OrgID:     signedInUser.OrgID,
					IsFolder:  false,
					UID:       str,
					FolderID:  f1.ID,
					FolderUID: f1.UID,
					Slug:      str,
					Title:     str,
					Data:      simplejson.New(),
					Created:   now,
					Updated:   now,
				})

				dashTags = append(dashTags, &dashboardTag{
					DashboardID: dashID,
					Term:        fmt.Sprintf("tag%d", k),
				})
			}

			for k := 0; k < LEVEL2_FOLDER_NUM; k++ {
				f2, d2 := addFolder(orgID, generateID(IDs), fmt.Sprintf("folder%d_%d_%d", i, j, k), &f1.UID)
				folders = append(folders, f2)
				dashs = append(dashs, d2)

				for l := 0; l < LEVEL2_DASHBOARD_NUM; l++ {
					str := fmt.Sprintf("dashboard_%d_%d_%d_%d", i, j, k, l)
					dashID := generateID(IDs)
					dashs = append(dashs, &dashboards.Dashboard{
						ID:        dashID,
						OrgID:     signedInUser.OrgID,
						IsFolder:  false,
						UID:       str,
						FolderID:  f1.ID,
						FolderUID: f2.UID,
						Slug:      str,
						Title:     str,
						Data:      simplejson.New(),
						Created:   now,
						Updated:   now,
					})

					dashTags = append(dashTags, &dashboardTag{
						DashboardID: dashID,
						Term:        fmt.Sprintf("tag%d", l),
					})
				}
			}
		}
	}

	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.BulkInsert("folder", folders, opts)
		require.NoError(b, err)

		_, err = sess.BulkInsert("dashboard", dashs, opts)
		require.NoError(b, err)

		_, err = sess.BulkInsert("permission", permissions, opts)
		require.NoError(b, err)

		_, err = sess.BulkInsert("dashboard_tag", dashTags, opts)
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

func setupServer(b testing.TB, sc benchScenario, features featuremgmt.FeatureToggles) *web.Macaron {
	b.Helper()

	m := web.New()
	initCtx := &contextmodel.ReqContext{}
	m.Use(func(c *web.Context) {
		initCtx.Context = c
		initCtx.Logger = log.New("api-test")
		initCtx.SignedInUser = sc.signedInUser

		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), initCtx))
	})

	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()

	quotaSrv := quotatest.New(false, nil)

	dashStore, err := database.ProvideDashboardStore(sc.db, sc.cfg, features, tagimpl.ProvideService(sc.db))
	require.NoError(b, err)

	folderStore := folderimpl.ProvideDashboardFolderStore(sc.db)

	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	cfg := setting.NewCfg()
	actionSets := resourcepermissions.NewActionSetService()
	fStore := folderimpl.ProvideStore(sc.db)
	folderServiceWithFlagOn := folderimpl.ProvideService(
		fStore, ac, bus.ProvideBus(tracing.InitializeTracerForTest()), dashStore, folderStore,
		nil, sc.db, features, supportbundlestest.NewFakeBundleService(), nil, cfg, nil, tracing.InitializeTracerForTest(), nil, dualwrite.ProvideTestService(), sort.ProvideService(), apiserver.WithoutRestConfig)
	acSvc := acimpl.ProvideOSSService(
		sc.cfg, acdb.ProvideService(sc.db), actionSets, localcache.ProvideService(),
		features, tracing.InitializeTracerForTest(), sc.db, permreg.ProvidePermissionRegistry(), nil,
	)
	folderPermissions, err := ossaccesscontrol.ProvideFolderPermissions(
		cfg, features, routing.NewRouteRegister(), sc.db, ac, license, folderServiceWithFlagOn, acSvc, sc.teamSvc, sc.userSvc, actionSets)
	require.NoError(b, err)
	dashboardSvc, err := dashboardservice.ProvideDashboardServiceImpl(
		sc.cfg, dashStore, folderStore,
		features, folderPermissions, ac, actest.FakeService{},
		folderServiceWithFlagOn, nil, client.MockTestRestConfig{}, nil, quotaSrv, nil, nil, nil, dualwrite.ProvideTestService(), sort.ProvideService(),
		serverlock.ProvideService(sc.db, tracing.InitializeTracerForTest()),
		kvstore.NewFakeKVStore(),
	)
	require.NoError(b, err)

	_, err = ossaccesscontrol.ProvideDashboardPermissions(
		cfg, features, routing.NewRouteRegister(), sc.db, ac, license, dashboardSvc, folderServiceWithFlagOn, acSvc, sc.teamSvc, sc.userSvc, actionSets, dashboardSvc)
	require.NoError(b, err)

	starSvc := startest.NewStarServiceFake()
	starSvc.ExpectedUserStars = &star.GetUserStarsResult{UserStars: make(map[string]bool)}

	hs := &HTTPServer{
		CacheService:     localcache.New(5*time.Minute, 10*time.Minute),
		Cfg:              sc.cfg,
		SQLStore:         sc.db,
		Features:         features,
		QuotaService:     quotaSrv,
		SearchService:    search.ProvideService(sc.cfg, sc.db, starSvc, dashboardSvc, folderServiceWithFlagOn, features, sort.ProvideService()),
		folderService:    folderServiceWithFlagOn,
		DashboardService: dashboardSvc,
	}

	hs.AccessControl = acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	guardian.InitAccessControlGuardian(hs.Cfg, hs.AccessControl, hs.DashboardService, hs.folderService, log.NewNopLogger())

	m.Get("/api/folders", hs.GetFolders)
	m.Get("/api/search", hs.Search)

	return m
}

type f struct {
	ID          int64   `xorm:"pk autoincr 'id'"`
	OrgID       int64   `xorm:"org_id"`
	UID         string  `xorm:"uid"`
	ParentUID   *string `xorm:"parent_uid"`
	Title       string
	Description string

	Created time.Time
	Updated time.Time
}

func (f *f) TableName() string {
	return "folder"
}

// SQL bean helper to save tags
type dashboardTag struct {
	ID          int64 `xorm:"pk autoincr 'id'"`
	DashboardID int64 `xorm:"dashboard_id"`
	Term        string
}

func addFolder(orgID int64, id int64, uid string, parentUID *string) (*f, *dashboards.Dashboard) {
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
		Data:     simplejson.NewFromAny(map[string]any{"schemaVersion": 17, "title": title, "uid": uid, "version": 1}),
		IsFolder: true,
		Created:  now,
		Updated:  now,
	}
	return f, d
}

func generateID(reserved map[int64]struct{}) int64 {
	n := rand.Int63n(MAXIMUM_INT_POSTGRES)
	if _, existing := reserved[n]; existing {
		return generateID(reserved)
	}
	reserved[n] = struct{}{}
	return n
}
