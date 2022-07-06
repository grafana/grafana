package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// ConfigurationApi always forwards requests to grafana backend
type ConfigurationApi struct {
	grafana *AdminSrv
}

func NewConfiguration(grafana *AdminSrv) *ConfigurationApi {
	return &ConfigurationApi{
		grafana: grafana,
	}
}

func (f *ConfigurationApi) handleRouteGetAlertmanagers(c *models.ReqContext) response.Response {
	return f.grafana.RouteGetAlertmanagers(c)
}

func (f *ConfigurationApi) handleRouteGetNGalertConfig(c *models.ReqContext) response.Response {
	return f.grafana.RouteGetNGalertConfig(c)
}

func (f *ConfigurationApi) handleRoutePostNGalertConfig(c *models.ReqContext, body apimodels.PostableNGalertConfig) response.Response {
	return f.grafana.RoutePostNGalertConfig(c, body)
}

func (f *ConfigurationApi) handleRouteDeleteNGalertConfig(c *models.ReqContext) response.Response {
	return f.grafana.RouteDeleteNGalertConfig(c)
}
