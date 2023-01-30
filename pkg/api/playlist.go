package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) ValidateOrgPlaylist(c *contextmodel.ReqContext) {
	uid := web.Params(c.Req)[":uid"]
	query := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.OrgID}
	p, err := hs.playlistService.GetWithoutItems(c.Req.Context(), &query)

	if err != nil {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if p.OrgId == 0 {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if p.OrgId != c.OrgID {
		c.JsonApiErr(403, "You are not allowed to edit/view playlist", nil)
		return
	}
}

// swagger:route GET /playlists playlists searchPlaylists
//
// Get playlists.
//
// Responses:
// 200: searchPlaylistsResponse
// 500: internalServerError
func (hs *HTTPServer) SearchPlaylists(c *contextmodel.ReqContext) response.Response {
	query := c.Query("query")
	limit := c.QueryInt("limit")

	if limit == 0 {
		limit = 1000
	}

	searchQuery := playlist.GetPlaylistsQuery{
		Name:  query,
		Limit: limit,
		OrgId: c.OrgID,
	}

	playlists, err := hs.playlistService.Search(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(500, "Search failed", err)
	}

	return response.JSON(http.StatusOK, playlists)
}

// swagger:route GET /playlists/{uid} playlists getPlaylist
//
// Get playlist.
//
// Responses:
// 200: getPlaylistResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetPlaylist(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	cmd := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.OrgID}

	dto, err := hs.playlistService.Get(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Playlist not found", err)
	}

	return response.JSON(http.StatusOK, dto)
}

// swagger:route GET /playlists/{uid}/items playlists getPlaylistItems
//
// Get playlist items.
//
// Responses:
// 200: getPlaylistItemsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetPlaylistItems(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	cmd := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.OrgID}

	dto, err := hs.playlistService.Get(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Playlist not found", err)
	}

	return response.JSON(http.StatusOK, dto.Items)
}

// swagger:route GET /playlists/{uid}/dashboards playlists getPlaylistDashboards
//
// Get playlist dashboards.
//
// Responses:
// 200: getPlaylistDashboardsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetPlaylistDashboards(c *contextmodel.ReqContext) response.Response {
	playlistUID := web.Params(c.Req)[":uid"]

	playlists, err := hs.LoadPlaylistDashboards(c.Req.Context(), c.OrgID, c.SignedInUser, playlistUID)
	if err != nil {
		return response.Error(500, "Could not load dashboards", err)
	}

	return response.JSON(http.StatusOK, playlists)
}

// swagger:route DELETE /playlists/{uid} playlists deletePlaylist
//
// Delete playlist.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeletePlaylist(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]

	cmd := playlist.DeletePlaylistCommand{UID: uid, OrgId: c.OrgID}
	if err := hs.playlistService.Delete(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to delete playlist", err)
	}

	return response.JSON(http.StatusOK, "")
}

// swagger:route POST /playlists playlists createPlaylist
//
// Create playlist.
//
// Responses:
// 200: createPlaylistResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) CreatePlaylist(c *contextmodel.ReqContext) response.Response {
	cmd := playlist.CreatePlaylistCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgID

	p, err := hs.playlistService.Create(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Failed to create playlist", err)
	}

	return response.JSON(http.StatusOK, p)
}

// swagger:route PUT /playlists/{uid} playlists updatePlaylist
//
// Update playlist.
//
// Responses:
// 200: updatePlaylistResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) UpdatePlaylist(c *contextmodel.ReqContext) response.Response {
	cmd := playlist.UpdatePlaylistCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgId = c.OrgID
	cmd.UID = web.Params(c.Req)[":uid"]

	_, err := hs.playlistService.Update(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Failed to save playlist", err)
	}

	dto, err := hs.playlistService.Get(c.Req.Context(), &playlist.GetPlaylistByUidQuery{
		UID:   cmd.UID,
		OrgId: c.OrgID,
	})
	if err != nil {
		return response.Error(500, "Failed to load playlist", err)
	}
	return response.JSON(http.StatusOK, dto)
}

// swagger:parameters searchPlaylists
type SearchPlaylistsParams struct {
	// in:query
	// required:false
	Query string `json:"query"`
	// in:limit
	// required:false
	Limit int `json:"limit"`
}

// swagger:parameters getPlaylist
type GetPlaylistParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters getPlaylistItems
type GetPlaylistItemsParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters getPlaylistDashboards
type GetPlaylistDashboardsParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters deletePlaylist
type DeletePlaylistParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters updatePlaylist
type UpdatePlaylistParams struct {
	// in:body
	// required:true
	Body playlist.UpdatePlaylistCommand
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters createPlaylist
type CreatePlaylistParams struct {
	// in:body
	// required:true
	Body playlist.CreatePlaylistCommand
}

// swagger:response searchPlaylistsResponse
type SearchPlaylistsResponse struct {
	// The response message
	// in: body
	Body playlist.Playlists `json:"body"`
}

// swagger:response getPlaylistResponse
type GetPlaylistResponse struct {
	// The response message
	// in: body
	Body *playlist.PlaylistDTO `json:"body"`
}

// swagger:response getPlaylistItemsResponse
type GetPlaylistItemsResponse struct {
	// The response message
	// in: body
	Body []playlist.PlaylistItemDTO `json:"body"`
}

// swagger:response getPlaylistDashboardsResponse
type GetPlaylistDashboardsResponse struct {
	// The response message
	// in: body
	Body dtos.PlaylistDashboardsSlice `json:"body"`
}

// swagger:response updatePlaylistResponse
type UpdatePlaylistResponse struct {
	// The response message
	// in: body
	Body *playlist.PlaylistDTO `json:"body"`
}

// swagger:response createPlaylistResponse
type CreatePlaylistResponse struct {
	// The response message
	// in: body
	Body *playlist.Playlist `json:"body"`
}
