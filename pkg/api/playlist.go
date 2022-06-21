package api

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) ValidateOrgPlaylist(c *models.ReqContext) {
	uid := web.Params(c.Req)[":uid"]
	query := models.GetPlaylistByUidQuery{UID: uid, OrgId: c.OrgId}
	err := hs.SQLStore.GetPlaylist(c.Req.Context(), &query)

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

	return response.JSON(http.StatusOK, searchQuery.Result)
}

func (hs *HTTPServer) GetPlaylist(c *models.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	cmd := models.GetPlaylistByUidQuery{UID: uid, OrgId: c.OrgId}

	if err := hs.SQLStore.GetPlaylist(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Playlist not found", err)
	}

	playlistDTOs, _ := hs.LoadPlaylistItemDTOs(c.Req.Context(), uid, c.OrgId)

	dto := &models.PlaylistDTO{
		Id:       cmd.Result.Id,
		UID:      cmd.Result.UID,
		Name:     cmd.Result.Name,
		Interval: cmd.Result.Interval,
		OrgId:    cmd.Result.OrgId,
		Items:    playlistDTOs,
	}

	return response.JSON(http.StatusOK, dto)
}

func (hs *HTTPServer) LoadPlaylistItemDTOs(ctx context.Context, uid string, orgId int64) ([]models.PlaylistItemDTO, error) {
	playlistitems, err := hs.LoadPlaylistItems(ctx, uid, orgId)

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

func (hs *HTTPServer) LoadPlaylistItems(ctx context.Context, uid string, orgId int64) ([]models.PlaylistItem, error) {
	itemQuery := models.GetPlaylistItemsByUidQuery{PlaylistUID: uid, OrgId: orgId}
	if err := hs.SQLStore.GetPlaylistItem(ctx, &itemQuery); err != nil {
		return nil, err
	}

	return *itemQuery.Result, nil
}

func (hs *HTTPServer) GetPlaylistItems(c *models.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]

	playlistDTOs, err := hs.LoadPlaylistItemDTOs(c.Req.Context(), uid, c.OrgId)

	if err != nil {
		return response.Error(500, "Could not load playlist items", err)
	}

	return response.JSON(http.StatusOK, playlistDTOs)
}

func (hs *HTTPServer) GetPlaylistDashboards(c *models.ReqContext) response.Response {
	playlistUID := web.Params(c.Req)[":uid"]

	playlists, err := hs.LoadPlaylistDashboards(c.Req.Context(), c.OrgId, c.SignedInUser, playlistUID)
	if err != nil {
		return response.Error(500, "Could not load dashboards", err)
	}

	return response.JSON(http.StatusOK, playlists)
}

func (hs *HTTPServer) DeletePlaylist(c *models.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]

	cmd := models.DeletePlaylistCommand{UID: uid, OrgId: c.OrgId}
	if err := hs.SQLStore.DeletePlaylist(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to delete playlist", err)
	}

	return response.JSON(http.StatusOK, "")
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

	return response.JSON(http.StatusOK, cmd.Result)
}

func (hs *HTTPServer) UpdatePlaylist(c *models.ReqContext) response.Response {
	cmd := models.UpdatePlaylistCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId
	cmd.UID = web.Params(c.Req)[":uid"]

	if err := hs.SQLStore.UpdatePlaylist(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to save playlist", err)
	}

	playlistDTOs, err := hs.LoadPlaylistItemDTOs(c.Req.Context(), cmd.UID, c.OrgId)
	if err != nil {
		return response.Error(500, "Failed to save playlist", err)
	}

	cmd.Result.Items = playlistDTOs
	return response.JSON(http.StatusOK, cmd.Result)
}
