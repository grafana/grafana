package models

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func GetQueriesFromDashboard(dashboard *simplejson.Json) map[int64][]*simplejson.Json {
	result := make(map[int64][]*simplejson.Json)

	for _, panelObj := range dashboard.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)

		var panelQueries []*simplejson.Json

		for _, queryObj := range panel.Get("targets").MustArray() {
			panelQueries = append(panelQueries, simplejson.NewFromAny(queryObj))
		}

		result[panel.Get("id").MustInt64()] = panelQueries
	}

	return result
}
