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
	"github.com/grafana/grafana/pkg/api/routing"
	internalplaylist "github.com/grafana/grafana/pkg/registry/apps/playlist"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) registerPlaylistAPI(apiRoute routing.RouteRegister) {
	// Register the actual handlers
	// TODO: remove kubernetesPlaylists feature flag
	apiRoute.Group("/playlists", func(playlistRoute routing.RouteRegister) {
		// Use k8s client to implement legacy API
		handler := newPlaylistK8sHandler(hs)
		playlistRoute.Get("/", handler.searchPlaylists)
		playlistRoute.Get("/:uid", handler.getPlaylist)
		playlistRoute.Get("/:uid/items", handler.getPlaylistItems)
		playlistRoute.Delete("/:uid", handler.deletePlaylist)
		playlistRoute.Put("/:uid", handler.updatePlaylist)
		playlistRoute.Post("/", handler.createPlaylist)
	})
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

// swagger:route GET /playlists playlists searchPlaylists
//
// Get playlists.
//
// Responses:
// 200: searchPlaylistsResponse
// 500: internalServerError
//
// Deprecated: use /apis/playlist.grafana.app/
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
//
// Deprecated: use /apis/playlist.grafana.app/
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
//
// Deprecated: use /apis/playlist.grafana.app/
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
//
// Deprecated: use /apis/playlist.grafana.app/
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
//
// Deprecated: use /apis/playlist.grafana.app/
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
//
// Deprecated: use /apis/playlist.grafana.app/
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
