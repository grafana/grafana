package k8saccess

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
)

type httpHelper struct {
	access *k8sAccess
}

func newHTTPHelper(access *k8sAccess, router routing.RouteRegister) *httpHelper {
	s := &httpHelper{
		access: access,
	}

	// Must be admin for everything
	router.Group("/api/k8s", func(k8sRoute routing.RouteRegister) {
		k8sRoute.Get("/info", middleware.ReqOrgAdmin, routing.Wrap(s.showClientInfo))
		k8sRoute.Any("/proxy/*", middleware.ReqOrgAdmin, s.doProxy)
	})

	return s
}

func (s *httpHelper) showClientInfo(c *models.ReqContext) response.Response {
	client := s.access.GetSystemClient()
	if client == nil {
		return response.JSON(500, map[string]interface{}{
			"client": "none",
		})
	}

	v, err := client.ServerVersion()
	if err != nil {
		return response.Error(500, "unable to get server", err)
	}

	return response.JSON(200, map[string]interface{}{
		"version": v,
	})
}

func (s *httpHelper) doProxy(c *models.ReqContext) {
	_, _ = c.Resp.Write([]byte("TODO!"))
}
