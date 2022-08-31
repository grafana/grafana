package query

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
)

func GetUniqueDashboardDatasourceUids(dashboard *simplejson.Json) []string {
	var datasourceUids []string
	exists := map[string]bool{}

	for _, panelObj := range dashboard.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)
		uid := GetDataSourceUidFromJson(panel)

		// if uid is for a mixed datasource, get the datasource uids from the targets
		if uid == "-- Mixed --" {
			for _, target := range panel.Get("targets").MustArray() {
				target := simplejson.NewFromAny(target)
				datasourceUid := target.Get("datasource").Get("uid").MustString()
				if _, ok := exists[datasourceUid]; !ok {
					datasourceUids = append(datasourceUids, datasourceUid)
					exists[datasourceUid] = true
				}
			}
		} else {
			if _, ok := exists[uid]; !ok {
				datasourceUids = append(datasourceUids, uid)
				exists[uid] = true
			}
		}
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

			// if query target has no datasource, set it to have the datasource on the panel
			if _, ok := query.CheckGet("datasource"); !ok {
				uid := GetDataSourceUidFromJson(panel)
				datasource := map[string]interface{}{"type": "public-ds", "uid": uid}
				query.Set("datasource", datasource)
			}

			panelQueries = append(panelQueries, query)
		}

		result[panel.Get("id").MustInt64()] = panelQueries
	}

	return result
}

func HasExpressionQuery(queries []*simplejson.Json) bool {
	for _, query := range queries {
		uid := GetDataSourceUidFromJson(query)
		if expr.IsDataSource(uid) {
			return true
		}
	}

	return false
}

func GroupQueriesByDataSource(queries []*simplejson.Json) (result [][]*simplejson.Json) {
	byDataSource := make(map[string][]*simplejson.Json)

	for _, query := range queries {
		uid := GetDataSourceUidFromJson(query)
		byDataSource[uid] = append(byDataSource[uid], query)
	}

	for _, queries := range byDataSource {
		result = append(result, queries)
	}

	return
}

func GetDataSourceUidFromJson(query *simplejson.Json) string {
	uid := query.Get("datasource").Get("uid").MustString()

	// before 8.3 special types could be sent as datasource (expr)
	if uid == "" {
		uid = query.Get("datasource").MustString()
	}

	return uid
}
