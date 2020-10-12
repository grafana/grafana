package api

import (
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// createShortURL handles requests to create short URLs.
func (hs *HTTPServer) createShortURL(c *models.ReqContext, cmd dtos.CreateShortURLForm) Response {
	hs.log.Debug("Received request to create short URL", "path", cmd.Path)

	uid, err := hs.ShortURLService.CreateShortURL(c.SignedInUser, strings.TrimPrefix(cmd.Path, "/"))
	if err != nil {
		c.Logger.Error("Failed to create short URL", "error", err)
		return Error(500, "Failed to create short URL", err)
	}

	c.Logger.Debug("Created short URL", "uid", uid)

	return JSON(200, uid)
}

func (hs *HTTPServer) redirectFromShortURL(c *models.ReqContext) {
	shortURLUID := c.Params(":uid")

	if !util.IsValidShortUID(shortURLUID) {
		return
	}

	path, err := hs.ShortURLService.GetFullURLByUID(c.SignedInUser, shortURLUID)
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
