package search

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type Query struct {
	Title     string
	Tag       string
	OrgId     int64
	UserId    int64
	Limit     int
	IsStarred bool

	Result []*m.DashboardSearchHit
}

func Init() {
	bus.AddHandler("search", searchHandler)
	initJsonFileIndex()
}

func searchHandler(query *Query) error {
	dashQuery := m.SearchDashboardsQuery{
		Title:     query.Title,
		Tag:       query.Tag,
		UserId:    query.UserId,
		Limit:     query.Limit,
		IsStarred: query.IsStarred,
		OrgId:     query.OrgId,
	}

	if err := bus.Dispatch(&dashQuery); err != nil {
		return err
	}

	if err := setIsStarredFlagOnSearchResults(query.UserId, query.Result); err != nil {
		return err
	}

	query.Result = dashQuery.Result
	return nil
}

func setIsStarredFlagOnSearchResults(userId int64, hits []*m.DashboardSearchHit) error {
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
