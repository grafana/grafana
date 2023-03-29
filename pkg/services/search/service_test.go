package search

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/star/startest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
)

func TestSearch_SortedResults(t *testing.T) {
	ss := startest.NewStarServiceFake()
	db := dbtest.NewFakeDB()
	us := usertest.NewUserServiceFake()
	ds := dashboards.NewFakeDashboardService(t)
	ds.On("SearchDashboards", mock.Anything, mock.AnythingOfType("*dashboards.FindPersistedDashboardsQuery")).Run(func(args mock.Arguments) {
		q := args.Get(1).(*dashboards.FindPersistedDashboardsQuery)
		q.Result = model.HitList{
			&model.Hit{ID: 16, Title: "CCAA", Type: "dash-db", Tags: []string{"BB", "AA"}},
			&model.Hit{ID: 10, Title: "AABB", Type: "dash-db", Tags: []string{"CC", "AA"}},
			&model.Hit{ID: 15, Title: "BBAA", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
			&model.Hit{ID: 25, Title: "bbAAa", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
			&model.Hit{ID: 17, Title: "FOLDER", Type: "dash-folder"},
		}
	}).Return(nil)
	us.ExpectedSignedInUser = &user.SignedInUser{IsGrafanaAdmin: true}
	ss.ExpectedUserStars = &star.GetUserStarsResult{UserStars: map[int64]bool{10: true, 12: true}}
	svc := &SearchService{
		sqlstore:         db,
		starService:      ss,
		dashboardService: ds,
	}

	query := &Query{
		Limit: 2000,
		SignedInUser: &user.SignedInUser{
			IsGrafanaAdmin: true,
		},
	}

	err := svc.SearchHandler(context.Background(), query)
	require.Nil(t, err)

	// Assert results are sorted.
	assert.Equal(t, "FOLDER", query.Result[0].Title)
	assert.Equal(t, "AABB", query.Result[1].Title)
	assert.Equal(t, "BBAA", query.Result[2].Title)
	assert.Equal(t, "bbAAa", query.Result[3].Title)
	assert.Equal(t, "CCAA", query.Result[4].Title)

	// Assert tags are sorted.
	assert.Equal(t, "AA", query.Result[3].Tags[0])
	assert.Equal(t, "BB", query.Result[3].Tags[1])
	assert.Equal(t, "EE", query.Result[3].Tags[2])
}

func TestSearch_StarredResults(t *testing.T) {
	ss := startest.NewStarServiceFake()
	db := dbtest.NewFakeDB()
	us := usertest.NewUserServiceFake()
	ds := dashboards.NewFakeDashboardService(t)
	ds.On("SearchDashboards", mock.Anything, mock.AnythingOfType("*dashboards.FindPersistedDashboardsQuery")).Run(func(args mock.Arguments) {
		q := args.Get(1).(*dashboards.FindPersistedDashboardsQuery)
		q.Result = model.HitList{
			&model.Hit{ID: 1, Title: "A", Type: "dash-db"},
			&model.Hit{ID: 2, Title: "B", Type: "dash-db"},
			&model.Hit{ID: 3, Title: "C", Type: "dash-db"},
		}
	}).Return(nil)
	us.ExpectedSignedInUser = &user.SignedInUser{}
	ss.ExpectedUserStars = &star.GetUserStarsResult{UserStars: map[int64]bool{1: true, 3: true, 4: true}}
	svc := &SearchService{
		sqlstore:         db,
		starService:      ss,
		dashboardService: ds,
	}

	query := &Query{
		Limit:        2000,
		IsStarred:    true,
		SignedInUser: &user.SignedInUser{},
	}

	err := svc.SearchHandler(context.Background(), query)
	require.Nil(t, err)

	// Assert only starred dashboards are returned
	assert.Equal(t, 2, query.Result.Len())
	assert.Equal(t, "A", query.Result[0].Title)
	assert.Equal(t, "C", query.Result[1].Title)
}
