package search

import (
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
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

var jsonDashIndex *JsonDashIndex

func Init() {
	bus.AddHandler("search", searchHandler)

	jsonIndexCfg, _ := setting.Cfg.GetSection("dashboards.json")
	jsonIndexEnabled := jsonIndexCfg.Key("enabled").MustBool(false)

	if jsonIndexEnabled {
		jsonFilesPath := jsonIndexCfg.Key("path").String()
		if !filepath.IsAbs(jsonFilesPath) {
			jsonFilesPath = filepath.Join(setting.HomePath, jsonFilesPath)
		}

		orgIds := jsonIndexCfg.Key("org_ids").String()
		jsonDashIndex = NewJsonDashIndex(jsonFilesPath, orgIds)
	}
}

func searchHandler(query *Query) error {
	hits := make([]*m.DashboardSearchHit, 0)

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

	hits = append(hits, dashQuery.Result...)

	if jsonDashIndex != nil {
		jsonHits, err := jsonDashIndex.Search(query)
		if err != nil {
			return err
		}

		hits = append(hits, jsonHits...)
	}

	if err := setIsStarredFlagOnSearchResults(query.UserId, hits); err != nil {
		return err
	}

	query.Result = hits
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
