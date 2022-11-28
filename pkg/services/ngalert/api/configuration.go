package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// ConfigurationApiHandler always forwards requests to grafana backend
type ConfigurationApiHandler struct {
	grafana *ConfigSrv
}

func NewConfiguration(grafana *ConfigSrv) *ConfigurationApiHandler {
	return &ConfigurationApiHandler{
		grafana: grafana,
	}
}

func (f *ConfigurationApiHandler) handleRouteGetAlertmanagers(c *models.ReqContext) response.Response {
	return f.grafana.RouteGetAlertmanagers(c)
}

func (f *ConfigurationApiHandler) handleRouteGetNGalertConfig(c *models.ReqContext) response.Response {
	return f.grafana.RouteGetNGalertConfig(c)
}

func (f *ConfigurationApiHandler) handleRoutePostNGalertConfig(c *models.ReqContext, body apimodels.PostableNGalertConfig) response.Response {
	return f.grafana.RoutePostNGalertConfig(c, body)
}

func (f *ConfigurationApiHandler) handleRouteDeleteNGalertConfig(c *models.ReqContext) response.Response {
	return f.grafana.RouteDeleteNGalertConfig(c)
}

func (f *ConfigurationApiHandler) handleRouteGetStatus(c *models.ReqContext) response.Response {
	return f.grafana.RouteGetAlertingStatus(c)
}
