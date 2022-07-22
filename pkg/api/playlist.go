package api

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) ValidateOrgPlaylist(c *models.ReqContext) {
	uid := web.Params(c.Req)[":uid"]
	query := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.OrgId}
	p, err := hs.playlistService.Get(c.Req.Context(), &query)

	if err != nil {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if p.OrgId == 0 {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if p.OrgId != c.OrgId {
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

	playlists, err := hs.playlistService.Search(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(500, "Search failed", err)
	}

	return response.JSON(http.StatusOK, playlists)
}

func (hs *HTTPServer) GetPlaylist(c *models.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	cmd := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.OrgId}

	p, err := hs.playlistService.Get(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Playlist not found", err)
	}

	playlistDTOs, _ := hs.LoadPlaylistItemDTOs(c.Req.Context(), uid, c.OrgId)

	dto := &playlist.PlaylistDTO{
		Id:       p.Id,
		UID:      p.UID,
		Name:     p.Name,
		Interval: p.Interval,
		OrgId:    p.OrgId,
		Items:    playlistDTOs,
	}

	return response.JSON(http.StatusOK, dto)
}

func (hs *HTTPServer) LoadPlaylistItemDTOs(ctx context.Context, uid string, orgId int64) ([]playlist.PlaylistItemDTO, error) {
	playlistitems, err := hs.LoadPlaylistItems(ctx, uid, orgId)

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

func (hs *HTTPServer) LoadPlaylistItems(ctx context.Context, uid string, orgId int64) ([]playlist.PlaylistItem, error) {
	itemQuery := playlist.GetPlaylistItemsByUidQuery{PlaylistUID: uid, OrgId: orgId}
	items, err := hs.playlistService.GetItems(ctx, &itemQuery)
	if err != nil {
		return nil, err
	}

	return items, nil
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

	cmd := playlist.DeletePlaylistCommand{UID: uid, OrgId: c.OrgId}
	if err := hs.playlistService.Delete(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to delete playlist", err)
	}

	return response.JSON(http.StatusOK, "")
}

func (hs *HTTPServer) CreatePlaylist(c *models.ReqContext) response.Response {
	cmd := playlist.CreatePlaylistCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId

	p, err := hs.playlistService.Create(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Failed to create playlist", err)
	}

	return response.JSON(http.StatusOK, p)
}

func (hs *HTTPServer) UpdatePlaylist(c *models.ReqContext) response.Response {
	cmd := playlist.UpdatePlaylistCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgId
	cmd.UID = web.Params(c.Req)[":uid"]

	p, err := hs.playlistService.Update(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Failed to save playlist", err)
	}

	playlistDTOs, err := hs.LoadPlaylistItemDTOs(c.Req.Context(), cmd.UID, c.OrgId)
	if err != nil {
		return response.Error(500, "Failed to save playlist", err)
	}

	p.Items = playlistDTOs
	return response.JSON(http.StatusOK, p)
}
