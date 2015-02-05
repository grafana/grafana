package api

import (
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

// TODO: this needs to be cached or improved somehow
func setIsStarredFlagOnSearchResults(c *middleware.Context, hits []*m.DashboardSearchHit) error {
	if !c.IsSignedIn {
		return nil
	}

	query := m.GetUserStarsQuery{UserId: c.UserId}
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

func Search(c *middleware.Context) {
	queryText := c.Query("q")
	starred := c.Query("starred")
	limit := c.QueryInt("limit")

	if limit == 0 {
		limit = 200
	}

	result := m.SearchResult{
		Dashboards: []*m.DashboardSearchHit{},
		Tags:       []*m.DashboardTagCloudItem{},
	}

	if strings.HasPrefix(queryText, "tags!:") {

		query := m.GetDashboardTagsQuery{AccountId: c.AccountId}
		err := bus.Dispatch(&query)
		if err != nil {
			c.JsonApiErr(500, "Failed to get tags from database", err)
			return
		}
		result.Tags = query.Result
		result.TagsOnly = true

	} else {

		searchQueryRegEx, _ := regexp.Compile(`(tags:(\w*)\sAND\s)?(?:title:)?(.*)?`)
		matches := searchQueryRegEx.FindStringSubmatch(queryText)
		query := m.SearchDashboardsQuery{
			Title:     matches[3],
			Tag:       matches[2],
			UserId:    c.UserId,
			Limit:     limit,
			IsStarred: starred == "1",
			AccountId: c.AccountId,
		}

		err := bus.Dispatch(&query)
		if err != nil {
			c.JsonApiErr(500, "Search failed", err)
			return
		}

		if err := setIsStarredFlagOnSearchResults(c, query.Result); err != nil {
			c.JsonApiErr(500, "Failed to get user stars", err)
			return
		}

		result.Dashboards = query.Result
		for _, dash := range result.Dashboards {
			dash.Url = setting.AbsUrlTo("dashboard/db/" + dash.Slug)
		}
	}

	c.JSON(200, result)
}
