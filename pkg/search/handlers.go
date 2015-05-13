package search

import (
	"path/filepath"
	"sort"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

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

		jsonDashIndex = NewJsonDashIndex(jsonFilesPath)
		go jsonDashIndex.updateLoop()
	}
}

func searchHandler(query *Query) error {
	hits := make(HitList, 0)

	dashQuery := FindPersistedDashboardsQuery{
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

	sort.Sort(hits)

	if err := setIsStarredFlagOnSearchResults(query.UserId, hits); err != nil {
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

func GetDashboardFromJsonIndex(filename string) *m.Dashboard {
	if jsonDashIndex == nil {
		return nil
	}
	return jsonDashIndex.GetDashboard(filename)
}
