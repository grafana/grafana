package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/shortUrls"
)

// POST /api/goto
func (hs *HTTPServer) CreateShortUrl(c *models.ReqContext, cmd dtos.CreateShortUrlForm) Response {
	service := shortUrls.NewShortUrlService(c.OrgId, c.SignedInUser)
	result, err := service.CreateShortUrl(c.OrgId, cmd.Path)

	if err != nil {
		c.Logger.Error("Failed to create short url", "error", err)
		return Error(500, "Failed to create short url", err)
	}

	return JSON(200, result)
}
