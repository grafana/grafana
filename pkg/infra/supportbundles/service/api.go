package service

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (s *SupportBundleService) registerAPIEndpoints(routeRegister routing.RouteRegister) {
	routeRegister.Group(rootUrl, func(subrouter routing.RouteRegister) {
		subrouter.Get("/", middleware.ReqGrafanaAdmin, routing.Wrap(s.listSupportBundles))
		subrouter.Post("/", middleware.ReqGrafanaAdmin, routing.Wrap(s.createSupportBundle))
		subrouter.Get("/:id", middleware.ReqGrafanaAdmin, routing.Wrap(s.createSupportBundle))
	})
}

func (s *SupportBundleService) listSupportBundles(ctx *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, []string{})
}

func (s *SupportBundleService) createSupportBundle(ctx *models.ReqContext) response.Response {
	uid, err := s.CreateSupportBundle(context.Background())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to create support bundle", err)
	}

	return response.JSON(http.StatusOK, map[string]string{
		"uid":     uid,
		"message": "Support bundle will be available soon"})
}
func (s *SupportBundleService) getSupportBundle(c *models.ReqContext) {
	_ = web.Params(c.Req)[":uid"]

	c.Resp.Header().Set("Content-Type", "application/tar+gzip")

	http.ServeFile(c.Resp, c.Req, "")
}
