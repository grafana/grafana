package api

import (
	"errors"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// createShortURL handles requests to create short URLs.
func (hs *HTTPServer) createShortURL(c *models.ReqContext, cmd dtos.CreateShortURLCmd) Response {
	hs.log.Debug("Received request to create short URL", "path", cmd.Path)

	cmd.Path = strings.TrimSpace(cmd.Path)

	if path.IsAbs(cmd.Path) {
		hs.log.Error("Invalid short URL path", "path", cmd.Path)
		return Error(400, "Path should be relative", nil)
	}

	shortURL, err := hs.ShortURLService.CreateShortURL(c.Req.Context(), c.SignedInUser, cmd.Path)
	if err != nil {
		return Error(500, "Failed to create short URL", err)
	}

	url := path.Join(setting.AppUrl, "goto", shortURL.Uid)
	c.Logger.Debug("Created short URL", "url", url)

	dto := dtos.ShortURL{
		UID: shortURL.Uid,
		URL: url,
	}

	return JSON(200, dto)
}

func (hs *HTTPServer) redirectFromShortURL(c *models.ReqContext) {
	shortURLUID := c.Params(":uid")

	if !util.IsValidShortUID(shortURLUID) {
		return
	}

	shortURL, err := hs.ShortURLService.GetShortURLByUID(c.Req.Context(), c.SignedInUser, shortURLUID)
	if err != nil {
		if errors.Is(err, models.ErrShortURLNotFound) {
			hs.log.Debug("Not redirecting short URL since not found")
			return
		}

		hs.log.Error("Short URL redirection error", "err", err)
		return
	}

	hs.log.Debug("Redirecting short URL", "path", shortURL.Path)
	c.Redirect(setting.ToAbsUrl(shortURL.Path), 302)
}
