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
	hs.log.Debug("Received request to create short URL", "path", cmd.URL)

	uid, err := hs.ShortURLService.CreateShortURL(c.Req.Context(), c.SignedInUser, strings.TrimPrefix(cmd.URL, setting.AppUrl))
	if err != nil {
		return Error(500, "Failed to create short URL", err)
	}

	shortURL := path.Join(setting.AppUrl, "goto", uid)
	c.Logger.Debug("Created short URL", "shortURL", shortURL)

	return JSON(200, shortURL)
}

func (hs *HTTPServer) redirectFromShortURL(c *models.ReqContext) {
	shortURLUID := c.Params(":uid")

	if !util.IsValidShortUID(shortURLUID) {
		return
	}

	path, err := hs.ShortURLService.GetFullURLByUID(c.Req.Context(), c.SignedInUser, shortURLUID)
	if err != nil {
		if errors.Is(err, models.ErrShortURLNotFound) {
			hs.log.Debug("Not redirecting short URL since not found")
			return
		}

		hs.log.Error("Short URL redirection error", "err", err)
		return
	}

	hs.log.Debug("Redirecting short URL", "path", path)
	c.Redirect(setting.ToAbsUrl(path), 302)
}
