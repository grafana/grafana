package accesscontrol

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
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
	dashSvc.On("SearchDashboards", mock.Anything, &dashboards.FindPersistedDashboardsQuery{
		OrgId:        1,
		SignedInUser: user,
		Type:         "dash-db",
		Limit:        int64(100),
		Page:         int64(1),
		Filters: []any{
			p1,
			p2,
		},
	}).Return(model.HitList{
		&model.Hit{UID: "uid1", ID: 101},
		&model.Hit{UID: "uid2", ID: 102},
	}, nil)

	// Second call, with DashboardUID filter
	dashSvc.On("SearchDashboards", mock.Anything, &dashboards.FindPersistedDashboardsQuery{
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
	}).Return(model.HitList{
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
	query := annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        1,
		Page:         1,
	}

	result, err := authz.dashboardsWithVisibleAnnotations(context.Background(), query)
	assert.NoError(t, err)
	// Should return two dashboards
	assert.Equal(t, map[string]int64{"uid1": 101, "uid2": 102}, result)

	// Second call with DashboardUID
	query.DashboardUID = "uid1"
	result, err = authz.dashboardsWithVisibleAnnotations(context.Background(), query)
	assert.NoError(t, err)
	// Should only return one dashboard
	assert.Equal(t, map[string]int64{"uid1": 101}, result)
}
