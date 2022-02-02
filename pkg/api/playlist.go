package api

import (
	"context"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) ValidateOrgPlaylist(c *models.ReqContext) {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "id is invalid", nil)
		return
	}
	query := models.GetPlaylistByIdQuery{Id: id}
	err = hs.SQLStore.GetPlaylist(c.Req.Context(), &query)

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

func (hs *HTTPServer) SearchPlaylists(c *models.ReqContext) response.Response {
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

	err := hs.SQLStore.SearchPlaylists(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(500, "Search failed", err)
	}

	return response.JSON(200, searchQuery.Result)
}

func (hs *HTTPServer) GetPlaylist(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cmd := models.GetPlaylistByIdQuery{Id: id}

	if err := hs.SQLStore.GetPlaylist(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Playlist not found", err)
	}

	playlistDTOs, _ := hs.LoadPlaylistItemDTOs(c.Req.Context(), id)

	dto := &models.PlaylistDTO{
		Id:       cmd.Result.Id,
		Name:     cmd.Result.Name,
		Interval: cmd.Result.Interval,
		OrgId:    cmd.Result.OrgId,
		Items:    playlistDTOs,
	}

	return response.JSON(200, dto)
}

func (hs *HTTPServer) LoadPlaylistItemDTOs(ctx context.Context, id int64) ([]models.PlaylistItemDTO, error) {
	playlistitems, err := hs.LoadPlaylistItems(ctx, id)

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

func (hs *HTTPServer) LoadPlaylistItems(ctx context.Context, id int64) ([]models.PlaylistItem, error) {
	itemQuery := models.GetPlaylistItemsByIdQuery{PlaylistId: id}
	if err := hs.SQLStore.GetPlaylistItem(ctx, &itemQuery); err != nil {
		return nil, err
	}

	return *itemQuery.Result, nil
}

func (hs *HTTPServer) GetPlaylistItems(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	playlistDTOs, err := hs.LoadPlaylistItemDTOs(c.Req.Context(), id)

	if err != nil {
		return response.Error(500, "Could not load playlist items", err)
	}

	return response.JSON(200, playlistDTOs)
}

func (hs *HTTPServer) GetPlaylistDashboards(c *models.ReqContext) response.Response {
	playlistID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	playlists, err := hs.LoadPlaylistDashboards(c.Req.Context(), c.OrgId, c.SignedInUser, playlistID)
	if err != nil {
		return response.Error(500, "Could not load dashboards", err)
	}

	return response.JSON(200, playlists)
}

func (hs *HTTPServer) DeletePlaylist(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	cmd := models.DeletePlaylistCommand{Id: id, OrgId: c.OrgId}
	if err := hs.SQLStore.DeletePlaylist(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to delete playlist", err)
	}

	return response.JSON(200, "")
}

func (hs *HTTPServer) CreatePlaylist(c *models.ReqContext) response.Response {
	cmd := models.CreatePlaylistCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId

	if err := hs.SQLStore.CreatePlaylist(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to create playlist", err)
	}

	return response.JSON(200, cmd.Result)
}

func (hs *HTTPServer) UpdatePlaylist(c *models.ReqContext) response.Response {
	cmd := models.UpdatePlaylistCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId
	var err error
	cmd.Id, err = strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	if err := hs.SQLStore.UpdatePlaylist(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to save playlist", err)
	}

	playlistDTOs, err := hs.LoadPlaylistItemDTOs(c.Req.Context(), cmd.Id)
	if err != nil {
		return response.Error(500, "Failed to save playlist", err)
	}

	cmd.Result.Items = playlistDTOs
	return response.JSON(200, cmd.Result)
}
