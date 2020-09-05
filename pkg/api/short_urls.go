package api

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/shortUrls"
)

// GET /api/goto/:uid
func GetShortUrlPath(c *models.ReqContext) Response {
	service := shortUrls.NewShortUrlService(c.OrgId, c.SignedInUser)
	result, err := service.GetFullUrlByUID(c.Params(":uid"))
	if err != nil {
		if err == models.ErrShortUrlNotFound {
			return Error(404, "Not found", err)
		}
		return Error(500, "Failed to get short url", err)
	}

	return JSON(302, result)
}

// POST /api/goto
func CreateShortUrl(c *models.ReqContext, cmd models.CreateShortUrlCommand) Response {
	service := shortUrls.NewShortUrlService(c.OrgId, c.SignedInUser)
	cmd.Path = c.Params(":path")
	result, err := service.CreateShortUrl(&cmd)

	if err != nil {
		return Error(500, "Failed to create short url", err)
	}

	return JSON(200, result)
}
