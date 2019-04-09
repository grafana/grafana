package search

import (
	"sort"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
)

func init() {
	registry.RegisterService(&SearchService{})
}

type SearchService struct {
	Bus bus.Bus `inject:""`
}

func (s *SearchService) Init() error {
	s.Bus.AddHandler(s.searchHandler)
	return nil
}

func (s *SearchService) searchHandler(query *Query) error {
	dashQuery := FindPersistedDashboardsQuery{
		Title:        query.Title,
		SignedInUser: query.SignedInUser,
		IsStarred:    query.IsStarred,
		DashboardIds: query.DashboardIds,
		Type:         query.Type,
		FolderIds:    query.FolderIds,
		Tags:         query.Tags,
		Limit:        query.Limit,
		Page:         query.Page,
		Permission:   query.Permission,
	}

	if err := bus.Dispatch(&dashQuery); err != nil {
		return err
	}

	hits := make(HitList, 0)
	hits = append(hits, dashQuery.Result...)

	// sort main result array
	sort.Sort(hits)

	if int64(len(hits)) > query.Limit {
		hits = hits[0:query.Limit]
	}

	// sort tags
	for _, hit := range hits {
		sort.Strings(hit.Tags)
	}

	// add isStarred info
	if err := setIsStarredFlagOnSearchResults(query.SignedInUser.UserId, hits); err != nil {
		return err
	}

	query.Result = hits
	return nil
}

func setIsStarredFlagOnSearchResults(userId int64, hits []*Hit) error {
	query := m.GetUserStarsQuery{UserId: userId}
	if err := bus.Dispatch(&query); err != nil {
		return err
	}

	for _, dash := range hits {
		if _, exists := query.Result[dash.Id]; exists {
			dash.IsStarred = true
		}
	}

	return nil
}
