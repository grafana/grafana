package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type AlertmanagerApiHandler struct {
	AMSvc           *LotexAM
	GrafanaSvc      *AlertmanagerSrv
	DatasourceCache datasources.CacheService
}

// NewForkingAM implements a set of routes that proxy to various Alertmanager-compatible backends.
func NewForkingAM(datasourceCache datasources.CacheService, proxy *LotexAM, grafana *AlertmanagerSrv) *AlertmanagerApiHandler {
	return &AlertmanagerApiHandler{
		AMSvc:           proxy,
		GrafanaSvc:      grafana,
		DatasourceCache: datasourceCache,
	}
}

func (f *AlertmanagerApiHandler) getService(ctx *model.ReqContext) (*LotexAM, error) {
	_, err := getDatasourceByUID(ctx, f.DatasourceCache, apimodels.AlertmanagerBackend)
	if err != nil {
		return nil, err
	}
	return f.AMSvc, nil
}

func (f *AlertmanagerApiHandler) handleRouteGetAMStatus(ctx *model.ReqContext, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}

	return s.RouteGetAMStatus(ctx)
}

func (f *AlertmanagerApiHandler) handleRouteCreateSilence(ctx *model.ReqContext, body apimodels.PostableSilence, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}

	return s.RouteCreateSilence(ctx, body)
}

func (f *AlertmanagerApiHandler) handleRouteDeleteAlertingConfig(ctx *model.ReqContext, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}

	return s.RouteDeleteAlertingConfig(ctx)
}

func (f *AlertmanagerApiHandler) handleRouteDeleteSilence(ctx *model.ReqContext, silenceID string, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}

	return s.RouteDeleteSilence(ctx, silenceID)
}

func (f *AlertmanagerApiHandler) handleRouteGetAlertingConfig(ctx *model.ReqContext, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}

	return s.RouteGetAlertingConfig(ctx)
}

func (f *AlertmanagerApiHandler) handleRouteGetAMAlertGroups(ctx *model.ReqContext, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}

	return s.RouteGetAMAlertGroups(ctx)
}

func (f *AlertmanagerApiHandler) handleRouteGetAMAlerts(ctx *model.ReqContext, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}

	return s.RouteGetAMAlerts(ctx)
}

func (f *AlertmanagerApiHandler) handleRouteGetSilence(ctx *model.ReqContext, silenceID string, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}

	return s.RouteGetSilence(ctx, silenceID)
}

func (f *AlertmanagerApiHandler) handleRouteGetSilences(ctx *model.ReqContext, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}

	return s.RouteGetSilences(ctx)
}

func (f *AlertmanagerApiHandler) handleRoutePostAlertingConfig(ctx *model.ReqContext, body apimodels.PostableUserConfig, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	if !body.AlertmanagerConfig.ReceiverType().Can(apimodels.AlertmanagerReceiverType) {
		return errorToResponse(backendTypeDoesNotMatchPayloadTypeError(apimodels.AlertmanagerBackend, body.AlertmanagerConfig.ReceiverType().String()))
	}
	return s.RoutePostAlertingConfig(ctx, body)
}

func (f *AlertmanagerApiHandler) handleRoutePostAMAlerts(ctx *model.ReqContext, body apimodels.PostableAlerts, dsUID string) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}

	return s.RoutePostAMAlerts(ctx, body)
}

func (f *AlertmanagerApiHandler) handleRouteDeleteGrafanaSilence(ctx *model.ReqContext, id string) response.Response {
	return f.GrafanaSvc.RouteDeleteSilence(ctx, id)
}

func (f *AlertmanagerApiHandler) handleRouteDeleteGrafanaAlertingConfig(ctx *model.ReqContext) response.Response {
	return f.GrafanaSvc.RouteDeleteAlertingConfig(ctx)
}

func (f *AlertmanagerApiHandler) handleRouteCreateGrafanaSilence(ctx *model.ReqContext, body apimodels.PostableSilence) response.Response {
	return f.GrafanaSvc.RouteCreateSilence(ctx, body)
}

func (f *AlertmanagerApiHandler) handleRouteGetGrafanaAMStatus(ctx *model.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetAMStatus(ctx)
}

func (f *AlertmanagerApiHandler) handleRouteGetGrafanaAMAlerts(ctx *model.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetAMAlerts(ctx)
}

func (f *AlertmanagerApiHandler) handleRouteGetGrafanaAMAlertGroups(ctx *model.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetAMAlertGroups(ctx)
}

func (f *AlertmanagerApiHandler) handleRouteGetGrafanaAlertingConfig(ctx *model.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetAlertingConfig(ctx)
}

func (f *AlertmanagerApiHandler) handleRouteGetGrafanaSilence(ctx *model.ReqContext, id string) response.Response {
	return f.GrafanaSvc.RouteGetSilence(ctx, id)
}

func (f *AlertmanagerApiHandler) handleRouteGetGrafanaSilences(ctx *model.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetSilences(ctx)
}

func (f *AlertmanagerApiHandler) handleRoutePostGrafanaAlertingConfig(ctx *model.ReqContext, conf apimodels.PostableUserConfig) response.Response {
	if !conf.AlertmanagerConfig.ReceiverType().Can(apimodels.GrafanaReceiverType) {
		return errorToResponse(backendTypeDoesNotMatchPayloadTypeError(apimodels.GrafanaBackend, conf.AlertmanagerConfig.ReceiverType().String()))
	}
	return f.GrafanaSvc.RoutePostAlertingConfig(ctx, conf)
}

func (f *AlertmanagerApiHandler) handleRouteGetGrafanaReceivers(ctx *model.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetReceivers(ctx)
}

func (f *AlertmanagerApiHandler) handleRoutePostTestGrafanaReceivers(ctx *model.ReqContext, conf apimodels.TestReceiversConfigBodyParams) response.Response {
	return f.GrafanaSvc.RoutePostTestReceivers(ctx, conf)
}
