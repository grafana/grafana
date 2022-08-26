package starimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/star"
)

type lightweightDashboard struct {
	UID   string
	ID    int64
	OrgID int64
}

var testDashboards = []lightweightDashboard{
	{
		UID:   "blueberries",
		ID:    1,
		OrgID: 1,
	},
	{
		UID:   "lingonberries",
		ID:    2,
		OrgID: 1,
	},
	{
		UID:   "blackberries",
		ID:    3,
		OrgID: 1,
	},
	{
		UID:   "raspberries",
		ID:    4,
		OrgID: 1,
	},
	{
		UID:   "bananas",
		ID:    5,
		OrgID: 2,
	},
}

func TestStarByUID(t *testing.T) {
	svc := serviceForTest(t, testDashboards)

	// curl -XPOST "http://admin:admin@localhost:3000/api/user/stars/dashboard/uid/blueberries"
	// Star a dashboard.
	require.NoError(t, svc.Add(context.Background(), &star.StarDashboardCommand{
		UserID:       1,
		DashboardUID: testDashboards[0].UID,
	}))

	// curl "http://admin:admin@localhost:3000/api/user/stars"
	// Returns the newly starred dashboard.
	stars, err := svc.GetByUser(context.Background(), &star.GetUserStarsQuery{
		OrgID:  1,
		UserID: 1,
	})
	require.NoError(t, err)
	assert.True(t, stars.UserStars[testDashboards[0].ID])
	assert.Equal(t, testDashboards[0].UID, stars.DashboardUIDs[0])

	// curl -XDELETE "http://admin:admin@localhost:3000/api/user/stars/dashboard/uid/blueberries"
	// Remove the starred dashboard.
	require.NoError(t, svc.Delete(context.Background(), &star.UnstarDashboardCommand{
		UserID:       1,
		DashboardUID: testDashboards[0].UID,
	}))

	// curl "http://admin:admin@localhost:3000/api/user/stars"
	// Empty response, all starred dashboards are removed.
	stars, err = svc.GetByUser(context.Background(), &star.GetUserStarsQuery{
		OrgID:  1,
		UserID: 1,
	})
	require.NoError(t, err)
	assert.Empty(t, stars.UserStars)
	assert.Empty(t, stars.DashboardUIDs)
}

func TestStarByID(t *testing.T) {
	svc := serviceForTest(t, testDashboards)

	// curl -XPOST "http://admin:admin@localhost:3000/api/user/stars/dashboard/1"
	// Star a dashboard.
	require.NoError(t, svc.Add(context.Background(), &star.StarDashboardCommand{
		UserID:      1,
		DashboardID: testDashboards[0].ID,
	}))

	// curl "http://admin:admin@localhost:3000/api/user/stars"
	// Returns the newly starred dashboard.
	stars, err := svc.GetByUser(context.Background(), &star.GetUserStarsQuery{
		OrgID:  1,
		UserID: 1,
	})
	require.NoError(t, err)
	assert.True(t, stars.UserStars[testDashboards[0].ID])
	assert.Equal(t, testDashboards[0].UID, stars.DashboardUIDs[0])

	// curl -XDELETE "http://admin:admin@localhost:3000/api/user/stars/dashboard/1"
	// Remove the starred dashboard.
	require.NoError(t, svc.Delete(context.Background(), &star.UnstarDashboardCommand{
		UserID:      1,
		DashboardID: testDashboards[0].ID,
	}))

	// curl "http://admin:admin@localhost:3000/api/user/stars"
	// Empty response, all starred dashboards are removed.
	stars, err = svc.GetByUser(context.Background(), &star.GetUserStarsQuery{
		OrgID:  1,
		UserID: 1,
	})
	require.NoError(t, err)
	assert.Empty(t, stars.UserStars)
	assert.Empty(t, stars.DashboardUIDs)
}

func TestStarOrgs(t *testing.T) {
	svc := serviceForTest(t, testDashboards)

	// curl -XPOST "http://admin:admin@localhost:3000/api/user/stars/dashboard/1"
	// Star a dashboard from org 2.
	require.NoError(t, svc.Add(context.Background(), &star.StarDashboardCommand{
		UserID:      1,
		DashboardID: testDashboards[4].ID,
	}))

	// curl "http://admin:admin@localhost:3000/api/user/stars"
	// Empty response, the dashboard is in another ~castle~ org.
	stars, err := svc.GetByUser(context.Background(), &star.GetUserStarsQuery{
		OrgID:  1,
		UserID: 1,
	})
	require.NoError(t, err)
	assert.Empty(t, stars.UserStars)
	assert.Empty(t, stars.DashboardUIDs)
}

func TestStarUsers(t *testing.T) {
	svc := serviceForTest(t, testDashboards)

	// curl -XPOST "http://admin:admin@localhost:3000/api/user/stars/dashboard/1"
	// Star a dashboard with user 1.
	require.NoError(t, svc.Add(context.Background(), &star.StarDashboardCommand{
		UserID:      1,
		DashboardID: testDashboards[1].ID,
	}))

	// curl "http://admin:admin@localhost:3000/api/user/stars"
	// Returns starred dashboard.
	stars, err := svc.GetByUser(context.Background(), &star.GetUserStarsQuery{
		OrgID:  1,
		UserID: 1,
	})
	require.NoError(t, err)
	assert.NotEmpty(t, stars.UserStars)
	assert.NotEmpty(t, stars.DashboardUIDs)

	// curl "http://otheruser:password@localhost:3000/api/user/stars"
	// Empty response, the dashboard is starred by user 1.
	stars, err = svc.GetByUser(context.Background(), &star.GetUserStarsQuery{
		OrgID:  1,
		UserID: 2,
	})
	require.NoError(t, err)
	assert.Empty(t, stars.UserStars)
	assert.Empty(t, stars.DashboardUIDs)

	// Delete all stars from user 1.
	require.NoError(t, svc.DeleteByUser(context.Background(), 1))

	// curl "http://admin:admin@localhost:3000/api/user/stars"
	// Empty response, all dashboards have been unstarred.
	stars, err = svc.GetByUser(context.Background(), &star.GetUserStarsQuery{
		OrgID:  1,
		UserID: 1,
	})
	require.NoError(t, err)
	assert.Empty(t, stars.UserStars)
	assert.Empty(t, stars.DashboardUIDs)
}

func serviceForTest(t testing.TB, dashs []lightweightDashboard) *Service {
	dashboardsMock := dashboards.NewFakeDashboardService(t)
	dashboardsMock.On("GetDashboards", mock.Anything, mock.AnythingOfType("*models.GetDashboardsQuery")).Maybe().Run(func(args mock.Arguments) {
		query := args.Get(1).(*models.GetDashboardsQuery)
		res := dashboardListFromLWDashboards(query.DashboardUIds, query.DashboardIds, dashs)
		query.Result = res
	}).Return(nil)
	dashboardsMock.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Maybe().Run(func(args mock.Arguments) {
		query := args.Get(1).(*models.GetDashboardQuery)
		res := dashboardListFromLWDashboards([]string{query.Uid}, []int64{query.Id}, dashs)
		query.Result = res[0]
	}).Return(nil)

	return &Service{
		store:      newInmemory(),
		dashboards: dashboardsMock,
	}
}

func dashboardListFromLWDashboards(targetUIDs []string, targetIDs []int64, dashs []lightweightDashboard) []*models.Dashboard {
	// this is used to make the dashboard mock behave a bit more
	// like a fake. It's _very_ hacky, but it basically returns dashboards
	// that match the asked-for dashboard.

	ids := map[int64]struct{}{}
	uids := map[string]struct{}{}
	for _, id := range targetIDs {
		ids[id] = struct{}{}
	}
	for _, uid := range targetUIDs {
		uids[uid] = struct{}{}
	}

	res := []*models.Dashboard{}
	for _, dash := range dashs {
		_, UIDinQ := uids[dash.UID]
		_, IDinQ := ids[dash.ID]
		if !UIDinQ && !IDinQ {
			continue
		}

		res = append(res, &models.Dashboard{
			Uid:   dash.UID,
			Id:    dash.ID,
			OrgId: dash.OrgID,
		})
	}
	return res
}
