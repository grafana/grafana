package search

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	stars "github.com/grafana/grafana/pkg/services/stars/starstests"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSearch_SortedResults(t *testing.T) {
	ms := mockstore.NewSQLStoreMock()
	ms.ExpectedPersistedDashboards = models.HitList{
		&models.Hit{ID: 16, Title: "CCAA", Type: "dash-db", Tags: []string{"BB", "AA"}},
		&models.Hit{ID: 10, Title: "AABB", Type: "dash-db", Tags: []string{"CC", "AA"}},
		&models.Hit{ID: 15, Title: "BBAA", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
		&models.Hit{ID: 25, Title: "bbAAa", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
		&models.Hit{ID: 17, Title: "FOLDER", Type: "dash-folder"},
	}
	ms.ExpectedSignedInUser = &models.SignedInUser{IsGrafanaAdmin: true}

	fstars := stars.NewStarsServiceFake()
	fstars.ExpectedUserStars = map[int64]bool{10: true, 12: true}
	svc := &SearchService{
		sqlstore:    ms,
		starManager: fstars,
	}

	query := &Query{
		Limit: 2000,
		SignedInUser: &models.SignedInUser{
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
