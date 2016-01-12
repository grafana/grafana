package api

import (
	"errors"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"strconv"
)

func ValidateOrgPlaylist(c *middleware.Context) {
	id := c.ParamsInt64(":id")
	query := m.GetPlaylistByIdQuery{Id: id}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if query.Result.OrgId != c.OrgId {
		c.JsonApiErr(403, "You are not allowed to edit/view playlist", nil)
		return
	}
}

func SearchPlaylists(c *middleware.Context) Response {
	query := c.Query("query")
	limit := c.QueryInt("limit")

	if limit == 0 {
		limit = 1000
	}

	searchQuery := m.PlaylistQuery{
		Title: query,
		Limit: limit,
		OrgId: c.OrgId,
	}

	err := bus.Dispatch(&searchQuery)
	if err != nil {
		return ApiError(500, "Search failed", err)
	}

	return Json(200, searchQuery.Result)
}

func GetPlaylist(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")
	cmd := m.GetPlaylistByIdQuery{Id: id}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Playlist not found", err)
	}

	itemQuery := m.GetPlaylistItemsByIdQuery{PlaylistId: id}
	if err := bus.Dispatch(&itemQuery); err != nil {
		log.Warn("itemQuery failed: %v", err)
		return ApiError(500, "Playlist items not found", err)
	}

	playlistDTOs := make([]m.PlaylistItemDTO, 0)

	for _, item := range *itemQuery.Result {
		playlistDTOs = append(playlistDTOs, m.PlaylistItemDTO{
			Id:         item.Id,
			PlaylistId: item.PlaylistId,
			Type:       item.Type,
			Value:      item.Value,
			Order:      item.Order,
		})
	}

	dto := &m.PlaylistDTO{
		Id:       cmd.Result.Id,
		Title:    cmd.Result.Title,
		Timespan: cmd.Result.Timespan,
		OrgId:    cmd.Result.OrgId,
		Items:    playlistDTOs,
	}

	return Json(200, dto)
}

func LoadPlaylistItems(id int64) ([]m.PlaylistItem, error) {
	itemQuery := m.GetPlaylistItemsByIdQuery{PlaylistId: id}
	if err := bus.Dispatch(&itemQuery); err != nil {
		log.Warn("itemQuery failed: %v", err)
		return nil, errors.New("Playlist not found")
	}

	return *itemQuery.Result, nil
}

func LoadPlaylistDashboards(id int64) ([]m.PlaylistDashboardDto, error) {
	playlistItems, _ := LoadPlaylistItems(id)

	dashboardIds := make([]int64, 0)

	for _, i := range playlistItems {
		dashboardId, _ := strconv.ParseInt(i.Value, 10, 64)
		dashboardIds = append(dashboardIds, dashboardId)
	}

	if len(dashboardIds) == 0 {
		return make([]m.PlaylistDashboardDto, 0), nil
	}

	dashboardQuery := m.GetPlaylistDashboardsQuery{DashboardIds: dashboardIds}
	if err := bus.Dispatch(&dashboardQuery); err != nil {
		log.Warn("dashboardquery failed: %v", err)
		return nil, errors.New("Playlist not found")
	}

	dtos := make([]m.PlaylistDashboardDto, 0)
	for _, item := range *dashboardQuery.Result {
		dtos = append(dtos, m.PlaylistDashboardDto{
			Id:    item.Id,
			Slug:  item.Slug,
			Title: item.Title,
			Uri:   "db/" + item.Slug,
		})
	}

	return dtos, nil
}

func GetPlaylistItems(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")

	items, err := LoadPlaylistItems(id)

	if err != nil {
		return ApiError(500, "Could not load playlist items", err)
	}

	playlistDTOs := make([]m.PlaylistItemDTO, 0)

	for _, item := range items {
		playlistDTOs = append(playlistDTOs, m.PlaylistItemDTO{
			Id:         item.Id,
			PlaylistId: item.PlaylistId,
			Type:       item.Type,
			Value:      item.Value,
			Order:      item.Order,
			Title:      item.Title,
		})
	}

	return Json(200, playlistDTOs)
}

func GetPlaylistDashboards(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")

	playlists, err := LoadPlaylistDashboards(id)
	if err != nil {
		return ApiError(500, "Could not load dashboards", err)
	}

	return Json(200, playlists)
}

func DeletePlaylist(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")

	cmd := m.DeletePlaylistQuery{Id: id}
	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to delete playlist", err)
	}

	return Json(200, "")
}

func CreatePlaylist(c *middleware.Context, query m.CreatePlaylistQuery) Response {
	query.OrgId = c.OrgId
	err := bus.Dispatch(&query)
	if err != nil {
		return ApiError(500, "Failed to create playlist", err)
	}

	return Json(200, query.Result)
}

func UpdatePlaylist(c *middleware.Context, query m.UpdatePlaylistQuery) Response {
	err := bus.Dispatch(&query)
	if err != nil {
		return ApiError(500, "Failed to save playlist", err)
	}

	items, err := LoadPlaylistItems(query.Id)

	playlistDTOs := make([]m.PlaylistItemDTO, 0)

	for _, item := range items {
		playlistDTOs = append(playlistDTOs, m.PlaylistItemDTO{
			Id:         item.Id,
			PlaylistId: item.PlaylistId,
			Type:       item.Type,
			Value:      item.Value,
			Order:      item.Order,
		})
	}

	if err != nil {
		return ApiError(500, "Failed to save playlist", err)
	}

	query.Result.Items = playlistDTOs

	return Json(200, query.Result)
}
