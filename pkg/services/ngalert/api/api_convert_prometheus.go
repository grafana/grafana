package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type ConvertPrometheusSrv struct {
	logger log.Logger
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetRules(c *contextmodel.ReqContext) response.Response {
	return response.Error(501, "Not implemented", nil)
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusDeleteNamespace(c *contextmodel.ReqContext, namespaceTitle string) response.Response {
	return response.Error(501, "Not implemented", nil)
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusDeleteRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	return response.Error(501, "Not implemented", nil)
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetNamespace(c *contextmodel.ReqContext, namespaceTitle string) response.Response {
	return response.Error(501, "Not implemented", nil)
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	return response.Error(501, "Not implemented", nil)
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusPostRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, prometheusGroup apimodels.PrometheusRuleGroup) response.Response {
	return response.Error(501, "Not implemented", nil)
}
