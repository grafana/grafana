package api

import (
	"net/http"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	internalplaylist "github.com/grafana/grafana/pkg/registry/apps/playlist"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) registerPlaylistAPI(apiRoute routing.RouteRegister) {
	// Register the actual handlers
	// TODO: remove kubernetesPlaylists feature flag
	apiRoute.Group("/playlists", func(playlistRoute routing.RouteRegister) {
		if hs.Features.IsEnabledGlobally(featuremgmt.FlagKubernetesPlaylists) {
			// Use k8s client to implement legacy API
			handler := newPlaylistK8sHandler(hs)
			playlistRoute.Get("/", handler.searchPlaylists)
			playlistRoute.Get("/:uid", handler.getPlaylist)
			playlistRoute.Get("/:uid/items", handler.getPlaylistItems)
			playlistRoute.Delete("/:uid", handler.deletePlaylist)
			playlistRoute.Put("/:uid", handler.updatePlaylist)
			playlistRoute.Post("/", handler.createPlaylist)
		} else {
			// Legacy handlers
			playlistRoute.Get("/", routing.Wrap(hs.SearchPlaylists))
			playlistRoute.Get("/:uid", hs.validateOrgPlaylist, routing.Wrap(hs.GetPlaylist))
			playlistRoute.Get("/:uid/items", hs.validateOrgPlaylist, routing.Wrap(hs.GetPlaylistItems))
			playlistRoute.Delete("/:uid", middleware.ReqEditorRole, hs.validateOrgPlaylist, routing.Wrap(hs.DeletePlaylist))
			playlistRoute.Put("/:uid", middleware.ReqEditorRole, hs.validateOrgPlaylist, routing.Wrap(hs.UpdatePlaylist))
			playlistRoute.Post("/", middleware.ReqEditorRole, routing.Wrap(hs.CreatePlaylist))
		}
	})
}

func (hs *HTTPServer) validateOrgPlaylist(c *contextmodel.ReqContext) {
	uid := web.Params(c.Req)[":uid"]
	query := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.GetOrgID()}
	p, err := hs.playlistService.GetWithoutItems(c.Req.Context(), &query)

	if err != nil {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if p.OrgId == 0 {
		c.JsonApiErr(404, "Playlist not found", err)
		return
	}

	if p.OrgId != c.GetOrgID() {
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
		OrgId: c.GetOrgID(),
	}

	playlists, err := hs.playlistService.Search(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Search failed", err)
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
	cmd := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.GetOrgID()}

	dto, err := hs.playlistService.Get(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Playlist not found", err)
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
	cmd := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: c.GetOrgID()}

	dto, err := hs.playlistService.Get(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Playlist not found", err)
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

	cmd := playlist.DeletePlaylistCommand{UID: uid, OrgId: c.GetOrgID()}
	if err := hs.playlistService.Delete(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete playlist", err)
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
	cmd.OrgId = c.GetOrgID()

	p, err := hs.playlistService.Create(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create playlist", err)
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
	cmd.OrgId = c.GetOrgID()
	cmd.UID = web.Params(c.Req)[":uid"]

	_, err := hs.playlistService.Update(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to save playlist", err)
	}

	dto, err := hs.playlistService.Get(c.Req.Context(), &playlist.GetPlaylistByUidQuery{
		UID:   cmd.UID,
		OrgId: c.GetOrgID(),
	})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to load playlist", err)
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

type playlistK8sHandler struct {
	namespacer           request.NamespaceMapper
	gvr                  schema.GroupVersionResource
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider
}

//-----------------------------------------------------------------------------------------
// Playlist k8s wrapper functions
//-----------------------------------------------------------------------------------------

func newPlaylistK8sHandler(hs *HTTPServer) *playlistK8sHandler {
	gvr := schema.GroupVersionResource{
		Group:    v0alpha1.PlaylistKind().Group(),
		Version:  v0alpha1.PlaylistKind().Version(),
		Resource: v0alpha1.PlaylistKind().Plural(),
	}
	return &playlistK8sHandler{
		gvr:                  gvr,
		namespacer:           request.GetNamespaceMapper(hs.Cfg),
		clientConfigProvider: hs.clientConfigProvider,
	}
}

func (pk8s *playlistK8sHandler) searchPlaylists(c *contextmodel.ReqContext) {
	client, ok := pk8s.getClient(c)
	if !ok {
		return // error is already sent
	}
	out, err := client.List(c.Req.Context(), v1.ListOptions{})
	if err != nil {
		pk8s.writeError(c, err)
		return
	}

	query := strings.ToUpper(c.Query("query"))
	playlists := []playlist.Playlist{}
	for _, item := range out.Items {
		p := internalplaylist.UnstructuredToLegacyPlaylist(item)
		if p == nil {
			continue
		}
		if query != "" && !strings.Contains(strings.ToUpper(p.Name), query) {
			continue // query filter
		}
		playlists = append(playlists, *p)
	}
	c.JSON(http.StatusOK, playlists)
}

func (pk8s *playlistK8sHandler) getPlaylist(c *contextmodel.ReqContext) {
	client, ok := pk8s.getClient(c)
	if !ok {
		return // error is already sent
	}
	uid := web.Params(c.Req)[":uid"]
	out, err := client.Get(c.Req.Context(), uid, v1.GetOptions{})
	if err != nil {
		pk8s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, internalplaylist.UnstructuredToLegacyPlaylistDTO(*out))
}

func (pk8s *playlistK8sHandler) getPlaylistItems(c *contextmodel.ReqContext) {
	client, ok := pk8s.getClient(c)
	if !ok {
		return // error is already sent
	}
	uid := web.Params(c.Req)[":uid"]
	out, err := client.Get(c.Req.Context(), uid, v1.GetOptions{})
	if err != nil {
		pk8s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, internalplaylist.UnstructuredToLegacyPlaylistDTO(*out).Items)
}

func (pk8s *playlistK8sHandler) deletePlaylist(c *contextmodel.ReqContext) {
	client, ok := pk8s.getClient(c)
	if !ok {
		return // error is already sent
	}
	uid := web.Params(c.Req)[":uid"]
	err := client.Delete(c.Req.Context(), uid, v1.DeleteOptions{})
	if err != nil {
		pk8s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, "")
}

func (pk8s *playlistK8sHandler) updatePlaylist(c *contextmodel.ReqContext) {
	client, ok := pk8s.getClient(c)
	if !ok {
		return // error is already sent
	}
	uid := web.Params(c.Req)[":uid"]
	cmd := playlist.UpdatePlaylistCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		c.JsonApiErr(http.StatusBadRequest, "bad request data", err)
		return
	}
	obj := internalplaylist.LegacyUpdateCommandToUnstructured(cmd)
	obj.SetName(uid)
	existing, err := client.Get(c.Req.Context(), uid, v1.GetOptions{})
	if err != nil {
		pk8s.writeError(c, err)
		return
	}
	obj.SetResourceVersion(existing.GetResourceVersion())
	out, err := client.Update(c.Req.Context(), &obj, v1.UpdateOptions{})
	if err != nil {
		pk8s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, internalplaylist.UnstructuredToLegacyPlaylistDTO(*out))
}

func (pk8s *playlistK8sHandler) createPlaylist(c *contextmodel.ReqContext) {
	client, ok := pk8s.getClient(c)
	if !ok {
		return // error is already sent
	}
	cmd := playlist.UpdatePlaylistCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		c.JsonApiErr(http.StatusBadRequest, "bad request data", err)
		return
	}
	obj := internalplaylist.LegacyUpdateCommandToUnstructured(cmd)
	out, err := client.Create(c.Req.Context(), &obj, v1.CreateOptions{})
	if err != nil {
		pk8s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, internalplaylist.UnstructuredToLegacyPlaylistDTO(*out))
}

//-----------------------------------------------------------------------------------------
// Utility functions
//-----------------------------------------------------------------------------------------

func (pk8s *playlistK8sHandler) getClient(c *contextmodel.ReqContext) (dynamic.ResourceInterface, bool) {
	dyn, err := dynamic.NewForConfig(pk8s.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		c.JsonApiErr(500, "client", err)
		return nil, false
	}
	return dyn.Resource(pk8s.gvr).Namespace(pk8s.namespacer(c.OrgID)), true
}

func (pk8s *playlistK8sHandler) writeError(c *contextmodel.ReqContext, err error) {
	//nolint:errorlint
	statusError, ok := err.(*errors.StatusError)
	if ok {
		c.JsonApiErr(int(statusError.Status().Code), statusError.Status().Message, err)
		return
	}
	errhttp.Write(c.Req.Context(), err, c.Resp)
}
