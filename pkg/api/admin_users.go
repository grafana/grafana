package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func AdminSearchUsers(c *middleware.Context) {
	// query := c.QueryStrings("q")
	// page := c.QueryStrings("p")

	query := m.SearchUsersQuery{Query: "", Page: 0, Limit: 20}
	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to fetch collaboratos", err)
		return
	}

	c.JSON(200, query.Result)
}
