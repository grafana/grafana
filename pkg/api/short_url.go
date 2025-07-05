package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

// r.Post("/api/short-url/"
func (hs *HTTPServer) getCreateShortURLHandler() web.Handler {
	if hs.Features.IsEnabledGlobally(featuremgmt.FlagKubernetesShortURLs) {
		return hs.createKubernetesShortURLsHandler()
	}
	return hs.createShortURL
}

// r.Get("/goto/:uid/"
func (hs *HTTPServer) getredirectFromShortURLHandler() web.Handler {
	if hs.Features.IsEnabledGlobally(featuremgmt.FlagKubernetesShortURLs) {
		return hs.getKubernetesRedirectFromShortURL
	}
	return hs.redirectFromShortURL
}

func (hs *HTTPServer) getKubernetesRedirectFromShortURL(c *contextmodel.ReqContext) {
	shortURLUID := web.Params(c.Req)[":uid"]
	if !util.IsValidShortUID(shortURLUID) {
		return
	}

	// TODO: Here I need to call k8sStore.Get() (not the service that uses legacy store) to get the short URL resource.
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

	// TODO: Here I need to call k8sStore.Update() (not the service that uses legacy store) to update the short URL last seen value in the resource.
	// Failure to update LastSeenAt should still allow to redirect
	if err := hs.ShortURLService.UpdateLastSeenAt(c.Req.Context(), shortURL); err != nil {
		hs.log.Error("Failed to update short URL last seen at", "error", err)
	}

	hs.log.Debug("Redirecting short URL", "path", shortURL.Path)
	c.Redirect(setting.ToAbsUrl(shortURL.Path), 302)
}

func (hs *HTTPServer) createKubernetesShortURLsHandler() web.Handler {
	namespaceMapper := request.GetNamespaceMapper(hs.Cfg)
	hs.log.Info("using kubernetes short URL handler")
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := identity.GetRequester(r.Context())
		if err != nil || user == nil {
			errhttp.Write(r.Context(), fmt.Errorf("no user"), w)
			return
		}

		// Read the original payload
		cmd := dtos.CreateShortURLCmd{}
		if err := web.Bind(r, &cmd); err != nil {
			errhttp.Write(r.Context(), fmt.Errorf("bad request data: %w", err), w)
			return
		}

		generatedName, err := util.GetRandomString(8)
		if err != nil {
			errhttp.Write(r.Context(), fmt.Errorf("generate random string: %w", err), w)
			return
		}

		// Transform to Kubernetes resource format
		k8sPayload := map[string]interface{}{
			"metadata": map[string]interface{}{
				"generateName": generatedName,
			},
			"spec": map[string]interface{}{
				"path": cmd.Path,
			},
		}

		// Convert to JSON and create new request body
		jsonPayload, err := json.Marshal(k8sPayload)
		if err != nil {
			errhttp.Write(r.Context(), fmt.Errorf("failed to marshal payload: %w", err), w)
			return
		}

		// Create new request with transformed payload
		newRequest := r.Clone(r.Context())
		newRequest.Body = io.NopCloser(bytes.NewReader(jsonPayload))
		newRequest.ContentLength = int64(len(jsonPayload))
		newRequest.Header.Set("Content-Type", "application/json")
		newRequest.Header.Set("Content-Length", fmt.Sprintf("%d", len(jsonPayload)))

		// Set the correct URL path
		newRequest.URL.Path = "/apis/shorturl.grafana.app/v0alpha1/namespaces/" + namespaceMapper(user.GetOrgID()) + "/shorturls"

		//TODO: the frontend expects a DTO I need to convert the response to a DTO
		hs.clientConfigProvider.DirectlyServeHTTP(w, newRequest)
	}
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
