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
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const dashNum = 10
const panelNum = 2
const panelQuery = "apple"

func BenchmarkPanelTitleSearch(b *testing.B) {
	start := time.Now()
	b.Log("setup start")
	sc := setupDBPanelTitle(b)
	b.Log("setup time:", time.Since(start))

	benchmarks := []struct {
		desc        string
		url         string
		expectedLen int
		features    *featuremgmt.FeatureManager
	}{
		{
			desc:        "search specific dashboard",
			url:         "/api/search?type=dash-db&query=dashboard_" + fmt.Sprint(dashNum-1),
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "search specific panel with panel title feature enabled",
			url:         "/api/search?type=dash-panel&panelTitle=" + panelQuery,
			expectedLen: 1,
			features: featuremgmt.WithFeatures(
				featuremgmt.FlagPanelTitleSearchInV1,
				featuremgmt.FlagPermissionsFilterRemoveSubquery,
			),
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

// #TODO refactor so that there is less repetition with setupDB()
func setupDBPanelTitle(b testing.TB) benchScenario {
	b.Helper()
	db := sqlstore.InitTestDB(b)
	IDs := map[int64]struct{}{}

	opts := sqlstore.NativeSettingsForDialect(db.GetDialect())

	quotaService := quotatest.New(false, nil)
	cfg := setting.NewCfg()

	teamSvc := teamimpl.ProvideService(db, cfg)
	orgService, err := orgimpl.ProvideService(db, cfg, quotaService)
	require.NoError(b, err)

	cache := localcache.ProvideService()
	userSvc, err := userimpl.ProvideService(db, orgService, cfg, teamSvc, cache, &quotatest.FakeQuotaService{}, bundleregistry.ProvideService())
	require.NoError(b, err)

	var orgID int64 = 1

	u, err := userSvc.Create(context.Background(), &user.CreateUserCommand{
		OrgID: orgID,
		Login: "user0",
	})
	require.NoError(b, err)
	require.NotZero(b, u.ID)

	signedInUser := user.SignedInUser{UserID: u.ID, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {
			dashboards.ActionFoldersCreate:  {},
			dashboards.ActionFoldersWrite:   {dashboards.ScopeFoldersAll},
			dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsAll},
		},
	}}

	now := time.Now()

	// #TODO: add more dashboards and choose a later panel/dash to search for
	dashs := make([]*dashboards.Dashboard, 0, dashNum)
	panels := make([]*dashboards.Panel, 0, dashNum)
	for j := 0; j < dashNum; j++ {
		str := fmt.Sprintf("dashboard_%d", j)
		dashID := generateID(IDs)

		dashs = append(dashs, &dashboards.Dashboard{
			ID:       dashID,
			OrgID:    signedInUser.OrgID,
			IsFolder: false,
			UID:      str,
			Slug:     str,
			Title:    str,
			Data:     simplejson.New(),
			Created:  now,
			Updated:  now,
		})

		for k := 0; k < panelNum; k++ {
			panelTitle := fmt.Sprintf("panel_%d_%d ", j, k)
			// #TODO: refactor
			if j == dashNum-1 && k == panelNum-1 &&
				db.GetDialect().DriverName() != migrator.Postgres {
				panelTitle += fmt.Sprintf("%s ", panelQuery)
			}

			panels = append(panels, &dashboards.Panel{
				Dashid: dashID,
				Title:  panelTitle,
			})
		}
	}

	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err = sess.BulkInsert("dashboard", dashs, opts)
		require.NoError(b, err)

		_, err = sess.BulkInsert("panel", panels, opts)
		require.NoError(b, err)

		// #TODO refactor
		if db.GetDialect().DriverName() == migrator.Postgres {
			queriedPanel := fmt.Sprintf("panel_%d_%d ", dashNum-1, panelNum-1)

			_, err = sess.Exec(fmt.Sprintf(`UPDATE panel SET title = to_tsvector('%s') WHERE title != '%s';`,
				`Lorem Ipsum is simply dummy text `, queriedPanel))
			require.NoError(b, err)

			_, err = sess.Exec(fmt.Sprintf(`UPDATE panel SET title = to_tsvector('%s ') WHERE title = '%s';`, panelQuery, queriedPanel))
			require.NoError(b, err)
		}
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
