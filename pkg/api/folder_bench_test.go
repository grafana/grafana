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
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	acdb "github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/star/startest"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	LEVEL0_FOLDER_NUM  = 300
	LEVEL1_FOLDER_NUM  = 30
	LEVEL2_FOLDER_NUM  = 5
	LEAF_DASHBOARD_NUM = 50
	TEAM_NUM           = 50
	TEAM_MEMBER_NUM    = 5
)

func BenchmarkFolderService_GetRootFolders(b *testing.B) {
	start := time.Now()
	m, orgID, userWithPermissions := setupBench(b)
	b.Log("setup time:", time.Since(start))
	req := httptest.NewRequest(http.MethodGet, "/api/folders", nil)
	req = webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: userWithPermissions, OrgID: orgID})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rec := httptest.NewRecorder()
		m.ServeHTTP(rec, req)
		require.Equal(b, 200, rec.Code)
		var resp []dtos.FolderSearchHit
		err := json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(b, err)
		assert.Len(b, resp, LEVEL0_FOLDER_NUM)
	}
}

func BenchmarkFolderService_GetSubfolders(b *testing.B) {
	start := time.Now()
	m, orgID, userWithPermissions := setupBench(b)
	b.Log("setup time:", time.Since(start))
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/folders?parentUid=folder%d", LEVEL0_FOLDER_NUM-1), nil)
	req = webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: userWithPermissions, OrgID: orgID})
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rec := httptest.NewRecorder()
		m.ServeHTTP(rec, req)
		require.Equal(b, 200, rec.Code)
		var resp []dtos.FolderSearchHit
		err := json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(b, err)
		assert.Len(b, resp, LEVEL1_FOLDER_NUM)
	}
}

func BenchmarkFolderService_Search(b *testing.B) {
	start := time.Now()
	m, orgID, userWithPermissions := setupBench(b)
	b.Log("setup time:", time.Since(start))
	limit := LEVEL0_FOLDER_NUM * LEVEL1_FOLDER_NUM * LEVEL2_FOLDER_NUM * LEAF_DASHBOARD_NUM
	if limit > 5000 {
		limit = 5000
	}
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/search?type=dash-db&limit=%d", limit), nil)
	req = webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: userWithPermissions, OrgID: orgID})
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rec := httptest.NewRecorder()
		m.ServeHTTP(rec, req)
		require.Equal(b, 200, rec.Code)
		var resp []dtos.FolderSearchHit
		err := json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(b, err)
		assert.Len(b, resp, limit)
	}
}

func setupBench(b testing.TB) (*web.Macaron, int64, int64) {
	b.Helper()
	db := sqlstore.InitTestDB(b)
	quotaService := quotatest.New(false, nil)
	folderStore := folderimpl.ProvideDashboardFolderStore(db)
	cfg := setting.NewCfg()

	teamSvc := teamimpl.ProvideService(db, cfg)
	orgService, err := orgimpl.ProvideService(db, cfg, quotaService)
	require.NoError(b, err)

	cache := localcache.ProvideService()
	userSvc, err := userimpl.ProvideService(db, orgService, cfg, teamSvc, cache, &quotatest.FakeQuotaService{}, bundleregistry.ProvideService())
	require.NoError(b, err)

	featuresFlagOn := featuremgmt.WithFeatures("nestedFolders")
	dashStore, err := database.ProvideDashboardStore(db, db.Cfg, featuresFlagOn, tagimpl.ProvideService(db, db.Cfg), quotaService)
	require.NoError(b, err)

	origNewGuardian := guardian.New
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true, CanViewValue: true})

	b.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	ac := acimpl.ProvideAccessControl(cfg)
	folderServiceWithFlagOn := folderimpl.ProvideService(ac, bus.ProvideBus(tracing.InitializeTracerForTest()), cfg, dashStore, folderStore, db, featuresFlagOn)

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
	teamRoles := make([]accesscontrol.TeamRole, 0, TEAM_NUM)
	for i := 0; i <= TEAM_NUM; i++ {
		t, err := teamSvc.CreateTeam(fmt.Sprintf("team%d", i), "", orgID)
		require.NoError(b, err)
		require.NotZero(b, t.ID)
		signedInUser.Teams = append(signedInUser.Teams, t.ID)

		for _, userID := range userIDs {
			teamSvc.AddTeamMember(userID, orgID, t.ID, false, dashboards.PERMISSION_VIEW)
		}

		name := fmt.Sprintf("managed_team_role_%d", i)
		roles = append(roles, accesscontrol.Role{
			ID:      int64(i) + 1,
			UID:     name,
			Name:    name,
			Updated: now,
			Created: now,
		})

		teamRoles = append(teamRoles, accesscontrol.TeamRole{
			RoleID:  int64(i) + 1,
			OrgID:   orgID,
			TeamID:  t.ID,
			Created: now,
		})
	}
	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.InsertMulti(roles)
		require.NoError(b, err)

		_, err = sess.InsertMulti(teamRoles)
		return err
	})
	require.NoError(b, err)

	var roleID int64 = 1
	for i := 0; i < LEVEL0_FOLDER_NUM; i++ {
		f0, err := folderServiceWithFlagOn.Create(context.Background(), &folder.CreateFolderCommand{
			OrgID:        orgID,
			UID:          fmt.Sprintf("folder%d", i),
			Title:        fmt.Sprintf("folder%d", i),
			SignedInUser: &signedInUser,
		})
		require.NoError(b, err)

		permissions := []accesscontrol.Permission{
			{
				RoleID:  roleID,
				Action:  dashboards.ActionFoldersRead,
				Scope:   dashboards.ScopeFoldersProvider.GetResourceScopeUID(f0.UID),
				Updated: now,
				Created: now,
			},
			{
				RoleID:  roleID,
				Action:  dashboards.ActionDashboardsRead,
				Scope:   dashboards.ScopeFoldersProvider.GetResourceScopeUID(f0.UID),
				Updated: now,
				Created: now,
			},
		}

		err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			_, err = sess.InsertMulti(permissions)
			return err
		})
		require.NoError(b, err)

		// advance idx
		roleID++
		if roleID == TEAM_NUM {
			// restart
			roleID = 1
		}

		for j := 0; j < LEVEL1_FOLDER_NUM; j++ {
			f1, err := folderServiceWithFlagOn.Create(context.Background(), &folder.CreateFolderCommand{
				OrgID:        orgID,
				Title:        fmt.Sprintf("folder%d_%d", i, j),
				ParentUID:    f0.UID,
				SignedInUser: &signedInUser,
			})
			require.NoError(b, err)

			for k := 0; k < LEVEL2_FOLDER_NUM; k++ {
				f1, err := folderServiceWithFlagOn.Create(context.Background(), &folder.CreateFolderCommand{
					OrgID:        orgID,
					Title:        fmt.Sprintf("folder%d_%d_%d", i, j, k),
					ParentUID:    f1.UID,
					SignedInUser: &signedInUser,
				})
				require.NoError(b, err)

				dashes := make([]dashboards.Dashboard, 0, LEAF_DASHBOARD_NUM)
				for l := 0; l < LEAF_DASHBOARD_NUM; l++ {
					str := fmt.Sprintf("dashboard_%d_%d_%d_%d", i, j, k, l)
					dashes = append(dashes, dashboards.Dashboard{
						OrgID:    signedInUser.OrgID,
						IsFolder: false,
						UID:      str,
						FolderID: f1.ID,
						Slug:     str,
						Title:    str,
						Data:     simplejson.New(),
						Created:  now,
						Updated:  now,
					})
				}
				err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
					_, err := sess.InsertMulti(dashes)
					return err
				})
				require.NoError(b, err)
			}
		}
	}

	m := web.New()
	initCtx := &contextmodel.ReqContext{}
	m.Use(func(c *web.Context) {
		initCtx.Context = c
		initCtx.Logger = log.New("api-test")
		initCtx.SignedInUser = &signedInUser

		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), initCtx))
	})

	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()

	acSvc := acimpl.ProvideOSSService(cfg, acdb.ProvideService(db), cache, featuresFlagOn)

	folderPermissions, err := ossaccesscontrol.ProvideFolderPermissions(
		cfg, routing.NewRouteRegister(), db, ac, license, &dashboards.FakeDashboardStore{}, folderServiceWithFlagOn, acSvc, teamSvc, userSvc)
	require.NoError(b, err)
	dashboardPermissions, err := ossaccesscontrol.ProvideDashboardPermissions(
		cfg, routing.NewRouteRegister(), db, ac, license, &dashboards.FakeDashboardStore{}, folderServiceWithFlagOn, acSvc, teamSvc, userSvc)
	require.NoError(b, err)

	dashboardSvc, err := dashboardservice.ProvideDashboardServiceImpl(
		cfg, dashStore, folderStore, nil,
		featuresFlagOn, folderPermissions, dashboardPermissions, ac,
		folderServiceWithFlagOn,
	)
	require.NoError(b, err)

	starSvc := startest.NewStarServiceFake()
	starSvc.ExpectedUserStars = &star.GetUserStarsResult{UserStars: make(map[int64]bool)}
	hs := &HTTPServer{
		CacheService:  localcache.New(5*time.Minute, 10*time.Minute),
		Cfg:           cfg,
		SQLStore:      db,
		Features:      featuresFlagOn,
		QuotaService:  quotaService,
		SearchService: search.ProvideService(cfg, db, starSvc, dashboardSvc),
		folderService: folderServiceWithFlagOn,
	}

	m.Get("/api/folders", hs.GetFolders)
	m.Get("/api/search", hs.Search)

	return m, orgID, userIDs[len(userIDs)-1]
}
