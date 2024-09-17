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
	ds.On("SearchDashboards", mock.Anything, mock.AnythingOfType("*dashboards.FindPersistedDashboardsQuery")).Return(model.HitList{
		&model.Hit{ID: 16, Title: "CCAA", Type: "dash-db", Tags: []string{"BB", "AA"}},
		&model.Hit{ID: 10, Title: "AABB", Type: "dash-db", Tags: []string{"CC", "AA"}},
		&model.Hit{ID: 15, Title: "BBAA", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
		&model.Hit{ID: 25, Title: "bbAAa", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
		&model.Hit{ID: 17, Title: "FOLDER", Type: "dash-folder"},
	}, nil)
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

	hits, err := svc.SearchHandler(context.Background(), query)
	require.Nil(t, err)

	// Assert results are sorted.
	assert.Equal(t, "FOLDER", hits[0].Title)
	assert.Equal(t, "AABB", hits[1].Title)
	assert.Equal(t, "BBAA", hits[2].Title)
	assert.Equal(t, "bbAAa", hits[3].Title)
	assert.Equal(t, "CCAA", hits[4].Title)

	// Assert tags are sorted.
	assert.Equal(t, "AA", hits[3].Tags[0])
	assert.Equal(t, "BB", hits[3].Tags[1])
	assert.Equal(t, "EE", hits[3].Tags[2])
}

func TestSearch_StarredResults(t *testing.T) {
	ss := startest.NewStarServiceFake()
	db := dbtest.NewFakeDB()
	us := usertest.NewUserServiceFake()
	ds := dashboards.NewFakeDashboardService(t)
	ds.On("SearchDashboards", mock.Anything, mock.AnythingOfType("*dashboards.FindPersistedDashboardsQuery")).Return(model.HitList{
		&model.Hit{ID: 1, Title: "A", Type: "dash-db"},
		&model.Hit{ID: 2, Title: "B", Type: "dash-db"},
		&model.Hit{ID: 3, Title: "C", Type: "dash-db"},
	}, nil)
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

	hits, err := svc.SearchHandler(context.Background(), query)
	require.Nil(t, err)

	// Assert only starred dashboards are returned
	assert.Equal(t, 2, hits.Len())
	assert.Equal(t, "A", hits[0].Title)
	assert.Equal(t, "C", hits[1].Title)
}
