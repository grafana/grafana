package search

import (
	"log"
	"path/filepath"
	"sort"

	"github.com/Cepave/grafana/pkg/bus"
	m "github.com/Cepave/grafana/pkg/models"
	"github.com/Cepave/grafana/pkg/setting"
)

var jsonDashIndex *JsonDashIndex

func Init() {
	bus.AddHandler("search", searchHandler)

	jsonIndexCfg, _ := setting.Cfg.GetSection("dashboards.json")

	if jsonIndexCfg == nil {
		log.Fatal("Config section missing: dashboards.json")
		return
	}

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
		UserId:    query.UserId,
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

	// filter out results with tag filter
	if len(query.Tags) > 0 {
		filtered := HitList{}
		for _, hit := range hits {
			if hasRequiredTags(query.Tags, hit.Tags) {
				filtered = append(filtered, hit)
			}
		}
		hits = filtered
	}

	// sort main result array
	sort.Sort(hits)

	if len(hits) > query.Limit {
		hits = hits[0:query.Limit]
	}

	// sort tags
	for _, hit := range hits {
		sort.Strings(hit.Tags)
	}

	// add isStarred info
	if err := setIsStarredFlagOnSearchResults(query.UserId, hits); err != nil {
		return err
	}

	query.Result = hits
	return nil
}

func stringInSlice(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}

func hasRequiredTags(queryTags, hitTags []string) bool {
	for _, queryTag := range queryTags {
		if !stringInSlice(queryTag, hitTags) {
			return false
		}
	}

	return true
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
