package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"

	"github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
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
		apiRoute.Get("/api/short-urls/:uid", reqSignedIn, handler.getKubernetesShortURLsHandler)
		apiRoute.Get("/goto/:uid", reqSignedIn, handler.getKubernetesRedirectFromShortURL, hs.Index)
	} else {
		apiRoute.Post("/api/short-urls", reqSignedIn, hs.createShortURL)
		apiRoute.Get("/api/short-urls/:uid", reqSignedIn, hs.getShortURL)
		apiRoute.Get("/goto/:uid", reqSignedIn, hs.redirectFromShortURL, hs.Index)
	}
}

// createShortURL handles requests to create short URLs.
func (hs *HTTPServer) createShortURL(c *contextmodel.ReqContext) response.Response {
	cmd := &dtos.CreateShortURLCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Err(shorturls.ErrShortURLBadRequest.Errorf("bad request data: %w", err))
	}
	hs.log.Debug("Received request to create short URL", "path", cmd.Path)
	shortURL, err := hs.ShortURLService.CreateShortURL(c.Req.Context(), c.SignedInUser, cmd)
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
			c.Redirect(hs.Cfg.AppURL, http.StatusPermanentRedirect)
			return
		}
		hs.log.Error("Short URL redirection error", "err", err)
		c.Redirect(hs.Cfg.AppURL, http.StatusTemporaryRedirect)
		return
	}

	// Failure to update LastSeenAt should still allow to redirect
	if err := hs.ShortURLService.UpdateLastSeenAt(c.Req.Context(), shortURL); err != nil {
		hs.log.Error("Failed to update short URL last seen at", "error", err)
	}

	hs.log.Debug("Redirecting short URL", "path", shortURL.Path)
	c.Redirect(setting.ToAbsUrl(shortURL.Path), http.StatusFound)
}

// getShortURL handles requests to get short URLs.
func (hs *HTTPServer) getShortURL(c *contextmodel.ReqContext) response.Response {
	shortURLUID := web.Params(c.Req)[":uid"]

	if !util.IsValidShortUID(shortURLUID) {
		return response.Err(shorturls.ErrShortURLBadRequest.Errorf("invalid uid"))
	}

	shortURL, err := hs.ShortURLService.GetShortURLByUID(c.Req.Context(), c.SignedInUser, shortURLUID)
	if err != nil {
		if shorturls.ErrShortURLNotFound.Is(err) {
			return response.Err(shorturls.ErrShortURLNotFound.Errorf("shorturl not found: %w", err))
		}
	}

	return response.JSON(http.StatusOK, shortURL)
}

type shortURLK8sHandler struct {
	namespacer           request.NamespaceMapper
	gvr                  schema.GroupVersionResource
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider
	cfg                  *setting.Cfg
}

func newShortURLK8sHandler(hs *HTTPServer) *shortURLK8sHandler {
	gvr := schema.GroupVersionResource{
		Group:    v1alpha1.ShortURLKind().Group(),
		Version:  v1alpha1.ShortURLKind().Version(),
		Resource: v1alpha1.ShortURLKind().Plural(),
	}
	return &shortURLK8sHandler{
		gvr:                  gvr,
		namespacer:           request.GetNamespaceMapper(hs.Cfg),
		clientConfigProvider: hs.clientConfigProvider,
		cfg:                  hs.Cfg,
	}
}

func (sk8s *shortURLK8sHandler) getKubernetesShortURLsHandler(c *contextmodel.ReqContext) {
	client, ok := sk8s.getClient(c)
	if !ok {
		return
	}

	shortURLUID := web.Params(c.Req)[":uid"]
	if !util.IsValidShortUID(shortURLUID) {
		c.JsonApiErr(http.StatusBadRequest, "Invalid short URL UID format", fmt.Errorf("invalid short URL UID: %s", shortURLUID))
		return
	}

	c.Logger.Debug("Fetching short URL", "uid", shortURLUID)
	out, err := client.Get(c.Req.Context(), shortURLUID, v1.GetOptions{})
	if err != nil {
		sk8s.writeError(c, err)
		return
	}

	c.JSON(http.StatusOK, shorturl.UnstructuredToLegacyShortURL(*out))
}

func (sk8s *shortURLK8sHandler) getKubernetesRedirectFromShortURL(c *contextmodel.ReqContext) {
	uid := web.Params(c.Req)[":uid"]
	if !util.IsValidShortUID(uid) {
		c.Logger.Warn("Invalid short URL UID format", "uid", uid)
		c.Redirect(sk8s.cfg.AppURL, http.StatusFound)
		return
	}

	client, err := kubernetes.NewForConfig(sk8s.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		c.JsonApiErr(500, "client", err)
		return
	}

	result := client.RESTClient().Get().
		Prefix("apis", v1alpha1.APIGroup, v1alpha1.APIVersion).
		Namespace(sk8s.namespacer(c.OrgID)).
		Resource(v1alpha1.ShortURLKind().Plural()).
		Name(uid).
		SubResource("goto").
		Param("redirect", "false"). // returns the URL and then we will do the redirect
		Do(c.Req.Context())

	if err = result.Error(); err != nil {
		c.JsonApiErr(500, "goto", err)
		return
	}

	body, err := result.Raw()
	if err != nil {
		c.JsonApiErr(500, "body", err)
		return
	}

	value := &v1alpha1.GetGoto{}
	if err = json.Unmarshal(body, value); err != nil {
		c.JsonApiErr(500, "unmarshal", err)
		return
	}
	if value.Url == "" {
		c.JsonApiErr(500, "invalid", fmt.Errorf("expected url"))
		return
	}

	c.Resp.Header().Add("Location", value.Url)
	c.Resp.WriteHeader(http.StatusFound)
}

func (sk8s *shortURLK8sHandler) createKubernetesShortURLsHandler(c *contextmodel.ReqContext) {
	client, ok := sk8s.getClient(c)
	if !ok {
		return
	}

	cmd := dtos.CreateShortURLCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		c.Logger.Error("Failed to bind request data", "error", err)
		c.JsonApiErr(http.StatusBadRequest, "bad request data", err)
		return
	}

	c.Logger.Debug("Creating short URL", "path", cmd.Path)
	obj := shorturl.LegacyCreateCommandToUnstructured(cmd)
	obj.SetGenerateName("u") // becomes a prefix

	out, err := client.Create(c.Req.Context(), &obj, v1.CreateOptions{})
	if err != nil {
		c.Logger.Error("Failed to create short URL in Kubernetes", "path", cmd.Path, "error", err)
		sk8s.writeError(c, err)
		return
	}

	c.Logger.Info("Successfully created short URL", "path", cmd.Path, "uid", out.GetName())
	c.JSON(http.StatusOK, shorturl.UnstructuredToLegacyShortURLDTO(*out, sk8s.cfg.AppURL))
}

//-----------------------------------------------------------------------------------------
// Utility functions
//-----------------------------------------------------------------------------------------

func (sk8s *shortURLK8sHandler) getClient(c *contextmodel.ReqContext) (dynamic.ResourceInterface, bool) {
	dyn, err := dynamic.NewForConfig(sk8s.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		c.JsonApiErr(500, "client", err)
		return nil, false
	}
	return dyn.Resource(sk8s.gvr).Namespace(sk8s.namespacer(c.OrgID)), true
}

func (sk8s *shortURLK8sHandler) writeError(c *contextmodel.ReqContext, err error) {
	//nolint:errorlint
	statusError, ok := err.(*errors.StatusError)
	if ok {
		c.JsonApiErr(int(statusError.Status().Code), statusError.Status().Message, err)
		return
	}
	errhttp.Write(c.Req.Context(), err, c.Resp)
}
