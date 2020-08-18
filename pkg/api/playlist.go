package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func ValidateOrgPlaylist(c *models.ReqContext) {
	id := c.ParamsInt64(":id")
	query := models.GetPlaylistByIdQuery{Id: id}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if query.Result.OrgId == 0 {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if query.Result.OrgId != c.OrgId {
		c.JsonApiErr(403, "You are not allowed to edit/view playlist", nil)
		return
	}
}

func SearchPlaylists(c *models.ReqContext) Response {
	query := c.Query("query")
	limit := c.QueryInt("limit")

	if limit == 0 {
		limit = 1000
	}

	searchQuery := models.GetPlaylistsQuery{
		Name:  query,
		Limit: limit,
		OrgId: c.OrgId,
	}

	err := bus.Dispatch(&searchQuery)
	if err != nil {
		return Error(500, "Search failed", err)
	}

	return JSON(200, searchQuery.Result)
}

func GetPlaylist(c *models.ReqContext) Response {
	id := c.ParamsInt64(":id")
	cmd := models.GetPlaylistByIdQuery{Id: id}

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Playlist not found", err)
	}

	playlistDTOs, _ := LoadPlaylistItemDTOs(id)

	dto := &models.PlaylistDTO{
		Id:       cmd.Result.Id,
		Name:     cmd.Result.Name,
		Interval: cmd.Result.Interval,
		OrgId:    cmd.Result.OrgId,
		Items:    playlistDTOs,
	}

	return JSON(200, dto)
}

func LoadPlaylistItemDTOs(id int64) ([]models.PlaylistItemDTO, error) {
	playlistitems, err := LoadPlaylistItems(id)

	if err != nil {
		return nil, err
	}

	playlistDTOs := make([]models.PlaylistItemDTO, 0)

	for _, item := range playlistitems {
		playlistDTOs = append(playlistDTOs, models.PlaylistItemDTO{
			Id:         item.Id,
			PlaylistId: item.PlaylistId,
			Type:       item.Type,
			Value:      item.Value,
			Order:      item.Order,
			Title:      item.Title,
		})
	}

	return playlistDTOs, nil
}

func LoadPlaylistItems(id int64) ([]models.PlaylistItem, error) {
	itemQuery := models.GetPlaylistItemsByIdQuery{PlaylistId: id}
	if err := bus.Dispatch(&itemQuery); err != nil {
		return nil, err
	}

	return *itemQuery.Result, nil
}

func GetPlaylistItems(c *models.ReqContext) Response {
	id := c.ParamsInt64(":id")

	playlistDTOs, err := LoadPlaylistItemDTOs(id)

	if err != nil {
		return Error(500, "Could not load playlist items", err)
	}

	return JSON(200, playlistDTOs)
}

func GetPlaylistDashboards(c *models.ReqContext) Response {
	playlistID := c.ParamsInt64(":id")

	playlists, err := LoadPlaylistDashboards(c.OrgId, c.SignedInUser, playlistID)
	if err != nil {
		return Error(500, "Could not load dashboards", err)
	}

	return JSON(200, playlists)
}

func DeletePlaylist(c *models.ReqContext) Response {
	id := c.ParamsInt64(":id")

	cmd := models.DeletePlaylistCommand{Id: id, OrgId: c.OrgId}
	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to delete playlist", err)
	}

	return JSON(200, "")
}

func CreatePlaylist(c *models.ReqContext, cmd models.CreatePlaylistCommand) Response {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to create playlist", err)
	}

	return JSON(200, cmd.Result)
}

func UpdatePlaylist(c *models.ReqContext, cmd models.UpdatePlaylistCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.Id = c.ParamsInt64(":id")

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to save playlist", err)
	}

	playlistDTOs, err := LoadPlaylistItemDTOs(cmd.Id)
	if err != nil {
		return Error(500, "Failed to save playlist", err)
	}

	cmd.Result.Items = playlistDTOs
	return JSON(200, cmd.Result)
}
