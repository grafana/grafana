package api

import (
	"regexp"
	"strings"

	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/utils"
)

func GetDashboard(c *middleware.Context) {
	slug := c.Params(":slug")

	query := m.GetDashboardQuery{Slug: slug, AccountId: c.GetAccountId()}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Dashboard not found", nil)
		return
	}

	query.Result.Data["id"] = query.Result.Id

	c.JSON(200, query.Result.Data)
}

func DeleteDashboard(c *middleware.Context) {
	slug := c.Params(":slug")

	query := m.GetDashboardQuery{Slug: slug, AccountId: c.GetAccountId()}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Dashboard not found", nil)
		return
	}

	cmd := m.DeleteDashboardCommand{Slug: slug, AccountId: c.GetAccountId()}
	err = bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete dashboard", err)
		return
	}

	var resp = map[string]interface{}{"title": query.Result.Title}

	c.JSON(200, resp)
}

func Search(c *middleware.Context) {
	queryText := c.Query("q")
	result := m.SearchResult{
		Dashboards: []*m.DashboardSearchHit{},
		Tags:       []*m.DashboardTagCloudItem{},
	}

	if strings.HasPrefix(queryText, "tags!:") {
		query := m.GetDashboardTagsQuery{}
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
			AccountId: c.GetAccountId(),
		}
		err := bus.Dispatch(&query)
		if err != nil {
			c.JsonApiErr(500, "Search failed", err)
			return
		}
		result.Dashboards = query.Result
	}

	c.JSON(200, result)
}

func PostDashboard(c *middleware.Context) {
	var cmd m.SaveDashboardCommand

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "bad request", nil)
		return
	}

	cmd.AccountId = c.GetAccountId()

	err := bus.Dispatch(&cmd)
	if err != nil {
		if err == m.ErrDashboardWithSameNameExists {
			c.JsonApiErr(400, "Dashboard with the same title already exists", nil)
			return
		}
		c.JsonApiErr(500, "Failed to save dashboard", err)
		return
	}

	c.JSON(200, utils.DynMap{"status": "success", "slug": cmd.Result.Slug})
}
