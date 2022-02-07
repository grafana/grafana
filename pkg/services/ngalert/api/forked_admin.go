package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// ForkedConfigurationApi always forwards requests to grafana backend
type ForkedConfigurationApi struct {
	grafana *AdminSrv
}

// NewForkedConfiguration creates a new ForkedConfigurationApi instance
func NewForkedConfiguration(grafana *AdminSrv) *ForkedConfigurationApi {
	return &ForkedConfigurationApi{
		grafana: grafana,
	}
}

func (f *ForkedConfigurationApi) forkRouteGetAlertmanagers(c *models.ReqContext) response.Response {
	return f.grafana.RouteGetAlertmanagers(c)
}

func (f *ForkedConfigurationApi) forkRouteGetNGalertConfig(c *models.ReqContext) response.Response {
	return f.grafana.RouteGetNGalertConfig(c)
}

func (f *ForkedConfigurationApi) forkRoutePostNGalertConfig(c *models.ReqContext, body apimodels.PostableNGalertConfig) response.Response {
	return f.grafana.RoutePostNGalertConfig(c, body)
}

func (f *ForkedConfigurationApi) forkRouteDeleteNGalertConfig(c *models.ReqContext) response.Response {
	return f.grafana.RouteDeleteNGalertConfig(c)
}
