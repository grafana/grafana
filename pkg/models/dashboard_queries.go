package models

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func GetAllDashboardDatasourceUids(dashboard *simplejson.Json) []string {
	var datasourceUids []string

	for _, panelObj := range dashboard.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)
		datasourceUids = append(datasourceUids, panel.Get("datasource").Get("uid").MustString())
	}

	return datasourceUids
}

func GroupQueriesByPanelId(dashboard *simplejson.Json) map[int64][]*simplejson.Json {
	result := make(map[int64][]*simplejson.Json)

	for _, panelObj := range dashboard.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)

		var panelQueries []*simplejson.Json

		for _, queryObj := range panel.Get("targets").MustArray() {
			query := simplejson.NewFromAny(queryObj)

			if _, ok := query.CheckGet("datasource"); !ok {
				query.Set("datasource", panel.Get("datasource"))
			}

			panelQueries = append(panelQueries, query)
		}

		result[panel.Get("id").MustInt64()] = panelQueries
	}

	return result
}

func GroupQueriesByDataSource(queries []*simplejson.Json) (result [][]*simplejson.Json) {
	byDataSource := make(map[string][]*simplejson.Json)

	for _, query := range queries {
		dataSourceUid, err := query.GetPath("datasource", "uid").String()

		if err != nil {
			continue
		}

		byDataSource[dataSourceUid] = append(byDataSource[dataSourceUid], query)
	}

	for _, queries := range byDataSource {
		result = append(result, queries)
	}

	return
}
