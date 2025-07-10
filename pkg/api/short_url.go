package api

import (
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/registry/apps/shorturl"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) registerShortURLAPI(apiRoute routing.RouteRegister) {
	reqSignedIn := middleware.ReqSignedIn

	if hs.Features.IsEnabledGlobally(featuremgmt.FlagKubernetesShortURLs) {
		handler := newShortURLK8sHandler(hs)
		apiRoute.Post("/api/short-urls", reqSignedIn, handler.createKubernetesShortURLsHandler)
		apiRoute.Get("/goto/:uid", reqSignedIn, handler.getKubernetesRedirectFromShortURL, hs.Index)
	} else {
		apiRoute.Post("/api/short-urls", reqSignedIn, hs.createShortURL)
		apiRoute.Get("/goto/:uid", reqSignedIn, hs.redirectFromShortURL, hs.Index)
	}
}

type shortURLK8sHandler struct {
	namespacer           request.NamespaceMapper
	gvr                  schema.GroupVersionResource
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider
}

func newShortURLK8sHandler(hs *HTTPServer) *shortURLK8sHandler {
	gvr := schema.GroupVersionResource{
		Group:    v0alpha1.ShortURLKind().Group(),
		Version:  v0alpha1.ShortURLKind().Version(),
		Resource: v0alpha1.ShortURLKind().Plural(),
	}
	return &shortURLK8sHandler{
		gvr:                  gvr,
		namespacer:           request.GetNamespaceMapper(hs.Cfg),
		clientConfigProvider: hs.clientConfigProvider,
	}
}

func (sk8s *shortURLK8sHandler) getKubernetesRedirectFromShortURL(c *contextmodel.ReqContext) {
	client, ok := sk8s.getClient(c)
	if !ok {
		return
	}

	shortURLUID := web.Params(c.Req)[":uid"]
	if !util.IsValidShortUID(shortURLUID) {
		return
	}

	out, err := client.Get(c.Req.Context(), shortURLUID, v1.GetOptions{})
	if err != nil {
		sk8s.writeError(c, err)
		return
	}

	c.JSON(http.StatusOK, shorturl.UnstructuredToLegacyShortURLDTO(*out))
}

func (sk8s *shortURLK8sHandler) createKubernetesShortURLsHandler(c *contextmodel.ReqContext) {
	client, ok := sk8s.getClient(c)
	if !ok {
		return
	}

	cmd := dtos.CreateShortURLCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		c.JsonApiErr(http.StatusBadRequest, "bad request data", err)
		return
	}

	obj := shorturl.LegacyCreateCommandToUnstructured(cmd)
	generateName, err := util.GetRandomString(8)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "failed to create generated name", err)
		return
	}

	obj.SetGenerateName(generateName)

	out, err := client.Create(c.Req.Context(), &obj, v1.CreateOptions{})
	if err != nil {
		sk8s.writeError(c, err)
		return
	}

	c.JSON(http.StatusOK, shorturl.UnstructuredToLegacyShortURLDTO(*out))
}

// createShortURL handles requests to create short URLs.
func (hs *HTTPServer) createShortURL(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.CreateShortURLCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Err(shorturls.ErrShortURLBadRequest.Errorf("bad request data: %w", err))
	}
	hs.log.Debug("Received request to create short URL", "path", cmd.Path)
	shortURL, err := hs.ShortURLService.CreateShortURL(c.Req.Context(), c.SignedInUser, cmd.Path)
	if err != nil {
		return response.Err(err)
	}

	shortURLDTO := hs.ShortURLService.ConvertShortURLToDTO(shortURL, hs.Cfg.AppURL)
	c.Logger.Debug("Created short URL", "url", shortURLDTO.URL)

	return response.JSON(http.StatusOK, shortURLDTO)
}

func (hs *HTTPServer) redirectFromShortURL(c *contextmodel.ReqContext) {
	shortURLUID := web.Params(c.Req)[":uid"]

	if !util.IsValidShortUID(shortURLUID) {
		return
	}

	shortURL, err := hs.ShortURLService.GetShortURLByUID(c.Req.Context(), c.SignedInUser, shortURLUID)
	if err != nil {
		// If we didn't get the URL for whatever reason, we redirect to the
		// main page, otherwise we get into an endless loops of redirects, as
		// we would try to redirect again.
		if shorturls.ErrShortURLNotFound.Is(err) {
			hs.log.Debug("Not redirecting short URL since not found", "uid", shortURLUID)
			c.Redirect(hs.Cfg.AppURL, 308)
			return
		}
		hs.log.Error("Short URL redirection error", "err", err)
		c.Redirect(hs.Cfg.AppURL, 307)
		return
	}

	// Failure to update LastSeenAt should still allow to redirect
	if err := hs.ShortURLService.UpdateLastSeenAt(c.Req.Context(), shortURL); err != nil {
		hs.log.Error("Failed to update short URL last seen at", "error", err)
	}

	hs.log.Debug("Redirecting short URL", "path", shortURL.Path)
	c.Redirect(setting.ToAbsUrl(shortURL.Path), 302)
}

//-----------------------------------------------------------------------------------------
// Utility functions
//-----------------------------------------------------------------------------------------

func (pk8s *shortURLK8sHandler) getClient(c *contextmodel.ReqContext) (dynamic.ResourceInterface, bool) {
	dyn, err := dynamic.NewForConfig(pk8s.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		c.JsonApiErr(500, "client", err)
		return nil, false
	}
	return dyn.Resource(pk8s.gvr).Namespace(pk8s.namespacer(c.OrgID)), true
}

func (pk8s *shortURLK8sHandler) writeError(c *contextmodel.ReqContext, err error) {
	//nolint:errorlint
	statusError, ok := err.(*errors.StatusError)
	if ok {
		c.JsonApiErr(int(statusError.Status().Code), statusError.Status().Message, err)
		return
	}
	errhttp.Write(c.Req.Context(), err, c.Resp)
}
