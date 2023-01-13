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
	if s.access.sys != nil {
		info := s.access.sys.getInfo()
		if s.access.sys.err != nil {
			return response.JSON(500, info)
		}
		return response.JSON(200, info)
	}
	return response.JSON(500, map[string]interface{}{
		"error": "no client initialized",
	})
}

func (s *httpHelper) doProxy(c *models.ReqContext) {
	// TODO... this does not yet do a real proxy
	if s.access.sys != nil {
		if s.access.sys.err == nil {
			s.access.sys.doProxy(c)
		} else {
			c.Resp.WriteHeader(500)
		}
		return
	}
	_, _ = c.Resp.Write([]byte("??"))
}
