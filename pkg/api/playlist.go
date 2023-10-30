package api

import (
	"net/http"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/middleware"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) registerPlaylistAPI(apiRoute routing.RouteRegister) {
	searchHandler := routing.Wrap(hs.SearchPlaylists)
	if hs.Features.IsEnabled(featuremgmt.FlagKubernetesPlaylistsAPI) {
		namespacer := request.GetNamespaceMapper(hs.Cfg)
		gvr := schema.GroupVersionResource{
			Group:    v0alpha1.GroupName,
			Version:  v0alpha1.VersionID,
			Resource: "playlists",
		}

		// For now -- test a single endpoint
		searchHandler = func(c *contextmodel.ReqContext) response.Response {
			dyn, err := dynamic.NewForConfig(hs.clientConfigProvider.GetDirectRestConfig(c))
			if err != nil {
				return response.Error(http.StatusInternalServerError, "config", err)
			}
			client := dyn.Resource(gvr).Namespace(namespacer(c.OrgID))
			out, err := client.List(c.Req.Context(), v1.ListOptions{})
			if err != nil {
				return response.Error(http.StatusBadRequest, "list error", err)
			}

			query := strings.ToUpper(c.Query("query"))
			playlists := []playlist.Playlist{}
			for _, item := range out.Items {
				p := v0alpha1.UnstructuredToLegacyPlaylist(&item)
				if p == nil {
					continue
				}
				if query != "" && !strings.Contains(strings.ToUpper(p.Name), query) {
					continue // query filter
				}
				playlists = append(playlists, *p)
			}
			return response.JSON(http.StatusOK, playlists)
		}
	}

	// Playlist API
	apiRoute.Group("/playlists", func(playlistRoute routing.RouteRegister) {
		playlistRoute.Get("/", searchHandler)
		playlistRoute.Get("/:uid", hs.validateOrgPlaylist, routing.Wrap(hs.GetPlaylist))
		playlistRoute.Get("/:uid/items", hs.validateOrgPlaylist, routing.Wrap(hs.GetPlaylistItems))
		playlistRoute.Delete("/:uid", middleware.ReqEditorRole, hs.validateOrgPlaylist, routing.Wrap(hs.DeletePlaylist))
		playlistRoute.Put("/:uid", middleware.ReqEditorRole, hs.validateOrgPlaylist, routing.Wrap(hs.UpdatePlaylist))
		playlistRoute.Post("/", middleware.ReqEditorRole, routing.Wrap(hs.CreatePlaylist))
	})
}

func (hs *HTTPServer) validateOrgPlaylist(c *contextmodel.ReqContext) {
	uid := web.Params(c.Req)[":uid"]
	query := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.SignedInUser.GetOrgID()}
	p, err := hs.playlistService.GetWithoutItems(c.Req.Context(), &query)

	if err != nil {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if p.OrgId == 0 {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if p.OrgId != c.SignedInUser.GetOrgID() {
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
		OrgId: c.SignedInUser.GetOrgID(),
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
	cmd := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.SignedInUser.GetOrgID()}

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
	cmd := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.SignedInUser.GetOrgID()}

	dto, err := hs.playlistService.Get(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Playlist not found", err)
	}

	return response.JSON(http.StatusOK, dto.Items)
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

	cmd := playlist.DeletePlaylistCommand{UID: uid, OrgId: c.SignedInUser.GetOrgID()}
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
	cmd.OrgId = c.SignedInUser.GetOrgID()

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
	cmd.OrgId = c.SignedInUser.GetOrgID()
	cmd.UID = web.Params(c.Req)[":uid"]

	_, err := hs.playlistService.Update(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Failed to save playlist", err)
	}

	dto, err := hs.playlistService.Get(c.Req.Context(), &playlist.GetPlaylistByUidQuery{
		UID:   cmd.UID,
		OrgId: c.SignedInUser.GetOrgID(),
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
