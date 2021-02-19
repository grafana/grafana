package search

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSearch_SortedResults(t *testing.T) {
	bus.AddHandler("test", func(query *FindPersistedDashboardsQuery) error {
		query.Result = HitList{
			&Hit{Id: 16, Title: "CCAA", Type: "dash-db", Tags: []string{"BB", "AA"}},
			&Hit{Id: 10, Title: "AABB", Type: "dash-db", Tags: []string{"CC", "AA"}},
			&Hit{Id: 15, Title: "BBAA", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
			&Hit{Id: 25, Title: "bbAAa", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
			&Hit{Id: 17, Title: "FOLDER", Type: "dash-folder"},
		}
		return nil
	})

	bus.AddHandler("test", func(query *models.GetUserStarsQuery) error {
		query.Result = map[int64]bool{10: true, 12: true}
		return nil
	})

	bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
		query.Result = &models.SignedInUser{IsGrafanaAdmin: true}
		return nil
	})

	svc := &SearchService{}

	query := &Query{
		Limit: 2000,
		SignedInUser: &models.SignedInUser{
			IsGrafanaAdmin: true,
		},
	}

	err := svc.searchHandler(query)
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
