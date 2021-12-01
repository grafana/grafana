package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// ForkedConfigurationApi always forwards requests to grafana backend
type ForkedConfigurationApi struct {
	grafana ConfigurationApiService
}

// NewForkedConfiguration creates a new ForkedConfigurationApi instance
func NewForkedConfiguration(grafana ConfigurationApiService) *ForkedConfigurationApi {
	return &ForkedConfigurationApi{
		grafana: grafana,
	}
}

func (r *ForkedConfigurationApi) forkRouteGetAlertmanagers(c *models.ReqContext) response.Response {
	return r.grafana.RouteGetAlertmanagers(c)
}

func (r *ForkedConfigurationApi) forkRouteGetNGalertConfig(c *models.ReqContext) response.Response {
	return r.grafana.RouteGetNGalertConfig(c)
}

func (r *ForkedConfigurationApi) forkRoutePostNGalertConfig(c *models.ReqContext, body apimodels.PostableNGalertConfig) response.Response {
	return r.grafana.RoutePostNGalertConfig(c, body)
}

func (r *ForkedConfigurationApi) forkRouteDeleteNGalertConfig(c *models.ReqContext) response.Response {
	return r.grafana.RouteDeleteNGalertConfig(c)
}
