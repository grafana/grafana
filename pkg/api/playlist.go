package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func SearchPlaylists(c *middleware.Context) {
	query := c.Query("query")
	limit := c.QueryInt("limit")

	if limit == 0 {
		limit = 1000
	}

	searchQuery := m.PlaylistQuery{
		Title: query,
		Limit: limit,
	}

	err := bus.Dispatch(&searchQuery)
	if err != nil {
		c.JsonApiErr(500, "Search failed", err)
		return
	}

	c.JSON(200, searchQuery.Result)
}

func GetPlaylist(c *middleware.Context) {
	id := c.ParamsInt64(":id")
	cmd := m.GetPlaylistByIdQuery{Id: id}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Playlist not found", err)
		return
	}

	c.JSON(200, cmd.Result)
}

func GetPlaylistDashboards(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	query := m.GetPlaylistDashboardsQuery{Id: id}
	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Playlist not found", err)
		return
	}

	c.JSON(200, query.Result)
}

func DeletePlaylist(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	cmd := m.DeletePlaylistQuery{Id: id}
	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to delete playlist", err)
		return
	}

	c.JSON(200, "")
}

func CreatePlaylist(c *middleware.Context, query m.CreatePlaylistQuery) {
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(500, "Failed to create playlist", err)
		return
	}

	c.JSON(200, query.Result)
}

func UpdatePlaylist(c *middleware.Context, query m.UpdatePlaylistQuery) {
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(500, "Failed to save playlist", err)
		return
	}

	c.JSON(200, query.Result)
}
