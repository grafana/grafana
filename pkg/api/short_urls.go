package api

import (
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/shorturls"
)

// POST /api/goto
func (hs *HTTPServer) CreateShortURL(c *models.ReqContext, cmd dtos.CreateShortURLForm) Response {
	service := shorturls.NewShortURLService(c.SignedInUser)
	result, err := service.CreateShortURL(strings.TrimPrefix(cmd.Path, "/"))

	if err != nil {
		c.Logger.Error("Failed to create short url", "error", err)
		return Error(500, "Failed to create short url", err)
	}

	return JSON(200, result)
}
