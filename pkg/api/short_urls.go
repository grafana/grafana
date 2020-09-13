package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/shortUrls"
	"github.com/grafana/grafana/pkg/util"
)

// GET /api/goto/:uid
func GetShortUrlPath(c *models.ReqContext) Response {
	service := shortUrls.NewShortUrlService(c.OrgId, c.SignedInUser)
	if !util.IsValidShortUID(c.Params(":uid")) {
		return Redirect("/malformed")
	}
	result, err := service.GetFullUrlByUID(c.Params(":uid"))
	if err != nil {
		if err == models.ErrShortUrlNotFound {
			return Redirect("/notfound")
		}
		return Redirect("/error")
	}

	return Redirect(result)
}

// POST /api/goto
func (hs *HTTPServer) CreateShortUrl(c *models.ReqContext, cmd dtos.CreateShortUrlForm) Response {
	service := shortUrls.NewShortUrlService(c.OrgId, c.SignedInUser)
	result, err := service.CreateShortUrl(&cmd)

	if err != nil {
		return Error(500, "Failed to create short url", err)
	}

	return JSON(200, result)
}
