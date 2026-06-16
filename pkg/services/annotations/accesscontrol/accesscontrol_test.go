package accesscontrol

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestDashboardsWithVisibleAnnotations(t *testing.T) {
	cfg := setting.NewCfg()

	signedInUser := &user.SignedInUser{OrgID: 1}

	dashSvc := &dashboards.FakeDashboardService{}

	// without DashboardUID: DashboardUIDs should be nil so the K8s search returns all visible dashboards
	queryAllDashboards := &dashboards.FindPersistedDashboardsQuery{
		OrgId:        1,
		SignedInUser: signedInUser,
		Type:         model.TypeAnnotation,
		Limit:        int64(100),
		Page:         int64(1),
	}
	dashSvc.On("SearchDashboards", mock.Anything, queryAllDashboards).Return(model.HitList{
		{UID: "uid1", ID: 101},
		{UID: "uid2", ID: 102},
	}, nil)

	// with DashboardUID: DashboardUIDs should be set so the K8s search is scoped to that dashboard
	queryOneDashboard := &dashboards.FindPersistedDashboardsQuery{
		DashboardUIDs: []string{"uid1"},
		OrgId:         1,
		SignedInUser:  signedInUser,
		Type:          model.TypeAnnotation,
		Limit:         int64(100),
		Page:          int64(1),
	}
	dashSvc.On("SearchDashboards", mock.Anything, queryOneDashboard).Return(model.HitList{
		{UID: "uid1", ID: 101},
	}, nil)

	authz := &AuthService{
		features:                  featuremgmt.WithFeatures(),
		dashSvc:                   dashSvc,
		searchDashboardsPageLimit: 100,
		maxDepth:                  cfg.MaxNestedFolderDepth,
	}

	t.Run("without DashboardUID returns all visible dashboards", func(t *testing.T) {
		result, err := authz.dashboardsWithVisibleAnnotations(context.Background(), annotations.ItemQuery{
			SignedInUser: signedInUser,
			OrgID:        1,
			Page:         1,
		})
		assert.NoError(t, err)
		assert.Equal(t, map[string]int64{"uid1": 101, "uid2": 102}, result)
		dashSvc.AssertCalled(t, "SearchDashboards", mock.Anything, queryAllDashboards)
	})

	t.Run("with DashboardUID filters to that dashboard", func(t *testing.T) {
		result, err := authz.dashboardsWithVisibleAnnotations(context.Background(), annotations.ItemQuery{
			SignedInUser: signedInUser,
			OrgID:        1,
			Page:         1,
			DashboardUID: "uid1",
		})
		assert.NoError(t, err)
		assert.Equal(t, map[string]int64{"uid1": 101}, result)
		dashSvc.AssertCalled(t, "SearchDashboards", mock.Anything, queryOneDashboard)
	})

	t.Run("passes signed-in user to SearchDashboards for K8s access control enforcement", func(t *testing.T) {
		dashSvc.AssertCalled(t, "SearchDashboards", mock.Anything, mock.MatchedBy(func(q *dashboards.FindPersistedDashboardsQuery) bool {
			return q.SignedInUser == signedInUser
		}))
	})
}
