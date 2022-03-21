package api

import (
	"context"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) ValidateOrgPlaylist(c *models.ReqContext) {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "id is invalid", nil)
		return
	}
	query := playlist.GetPlaylistByIdQuery{Id: id}
	playlistItem, err := hs.playlistService.GetPlaylist(c.Req.Context(), &query)

	if err != nil {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if playlistItem.OrgId == 0 {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if playlistItem.OrgId != c.OrgId {
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

	searchQuery := playlist.GetPlaylistsQuery{
		Name:  query,
		Limit: limit,
		OrgId: c.OrgId,
	}

	result, err := hs.playlistService.SearchPlaylists(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(500, "Search failed", err)
	}

	return response.JSON(200, result)
}

func (hs *HTTPServer) GetPlaylist(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cmd := playlist.GetPlaylistByIdQuery{Id: id}

	playlistObj, err := hs.playlistService.GetPlaylist(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Playlist not found", err)
	}

	playlistDTOs, _ := hs.LoadPlaylistItemDTOs(c.Req.Context(), id)

	dto := &playlist.PlaylistDTO{
		Id:       playlistObj.Id,
		Name:     playlistObj.Name,
		Interval: playlistObj.Interval,
		OrgId:    playlistObj.OrgId,
		Items:    playlistDTOs,
	}

	return response.JSON(200, dto)
}

func (hs *HTTPServer) LoadPlaylistItemDTOs(ctx context.Context, id int64) ([]playlist.PlaylistItemDTO, error) {
	playlistitems, err := hs.LoadPlaylistItems(ctx, id)

	if err != nil {
		return nil, err
	}

	playlistDTOs := make([]playlist.PlaylistItemDTO, 0)

	for _, item := range playlistitems {
		playlistDTOs = append(playlistDTOs, playlist.PlaylistItemDTO{
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

func (hs *HTTPServer) LoadPlaylistItems(ctx context.Context, id int64) ([]playlist.PlaylistItem, error) {
	itemQuery := playlist.GetPlaylistItemsByIdQuery{PlaylistId: id}
	playlistItem, err := hs.playlistService.GetPlaylistItem(ctx, &itemQuery)
	if err != nil {
		return nil, err
	}

	return *playlistItem.Items, nil
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

	cmd := playlist.DeletePlaylistCommand{Id: id, OrgId: c.OrgId}
	if err := hs.playlistService.DeletePlaylist(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to delete playlist", err)
	}

	return response.JSON(200, "")
}

func (hs *HTTPServer) CreatePlaylist(c *models.ReqContext) response.Response {
	cmd := playlist.CreatePlaylistCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId

	result, err := hs.playlistService.CreatePlaylist(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Failed to create playlist", err)
	}

	return response.JSON(200, result)
}

func (hs *HTTPServer) UpdatePlaylist(c *models.ReqContext) response.Response {
	cmd := playlist.UpdatePlaylistCommand{}
	result := playlist.PlaylistDTO{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId
	var err error
	cmd.Id, err = strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	_, err = hs.playlistService.UpdatePlaylist(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Failed to save playlist", err)
	}

	playlistDTOs, err := hs.LoadPlaylistItemDTOs(c.Req.Context(), cmd.Id)
	if err != nil {
		return response.Error(500, "Failed to save playlist", err)
	}

	result.Items = playlistDTOs
	return response.JSON(200, result)
}
