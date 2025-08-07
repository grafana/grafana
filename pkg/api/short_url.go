package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) registerShortURLAPI(apiRoute routing.RouteRegister) {
	reqSignedIn := middleware.ReqSignedIn
	apiRoute.Post("/api/short-urls", reqSignedIn, hs.createShortURL)
	apiRoute.Get("/goto/:uid", reqSignedIn, hs.redirectFromShortURL, hs.Index)
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

	url := fmt.Sprintf("%s/goto/%s?orgId=%d", strings.TrimSuffix(hs.Cfg.AppURL, "/"), shortURL.Uid, c.GetOrgID())
	c.Logger.Debug("Created short URL", "url", url)

	dto := dtos.ShortURL{
		UID: shortURL.Uid,
		URL: url,
	}

	return response.JSON(http.StatusOK, dto)
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
