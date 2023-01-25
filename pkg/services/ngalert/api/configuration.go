package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/contexthandler/model"
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

func (f *ConfigurationApiHandler) handleRouteGetAlertmanagers(c *model.ReqContext) response.Response {
	return f.grafana.RouteGetAlertmanagers(c)
}

func (f *ConfigurationApiHandler) handleRouteGetNGalertConfig(c *model.ReqContext) response.Response {
	return f.grafana.RouteGetNGalertConfig(c)
}

func (f *ConfigurationApiHandler) handleRoutePostNGalertConfig(c *model.ReqContext, body apimodels.PostableNGalertConfig) response.Response {
	return f.grafana.RoutePostNGalertConfig(c, body)
}

func (f *ConfigurationApiHandler) handleRouteDeleteNGalertConfig(c *model.ReqContext) response.Response {
	return f.grafana.RouteDeleteNGalertConfig(c)
}

func (f *ConfigurationApiHandler) handleRouteGetStatus(c *model.ReqContext) response.Response {
	return f.grafana.RouteGetAlertingStatus(c)
}
