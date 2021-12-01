package api

import (
	"fmt"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type ForkedAlertmanagerApi struct {
	AMSvc, GrafanaSvc AlertmanagerApiService
	DatasourceCache   datasources.CacheService
}

// NewForkedAM implements a set of routes that proxy to various Alertmanager-compatible backends.
func NewForkedAM(datasourceCache datasources.CacheService, proxy, grafana AlertmanagerApiService) *ForkedAlertmanagerApi {
	return &ForkedAlertmanagerApi{
		AMSvc:           proxy,
		GrafanaSvc:      grafana,
		DatasourceCache: datasourceCache,
	}
}

func (f *ForkedAlertmanagerApi) getService(ctx *models.ReqContext) (AlertmanagerApiService, error) {
	t, err := backendType(ctx, f.DatasourceCache)
	if err != nil {
		return nil, err
	}

	switch t {
	case apimodels.GrafanaBackend:
		return f.GrafanaSvc, nil
	case apimodels.AlertmanagerBackend:
		return f.AMSvc, nil
	default:
		return nil, fmt.Errorf("unexpected backend type (%v)", t)
	}
}

func (f *ForkedAlertmanagerApi) forkRouteGetAMStatus(ctx *models.ReqContext) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteGetAMStatus(ctx)
}

func (f *ForkedAlertmanagerApi) forkRouteCreateSilence(ctx *models.ReqContext, body apimodels.PostableSilence) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteCreateSilence(ctx, body)
}

func (f *ForkedAlertmanagerApi) forkRouteDeleteAlertingConfig(ctx *models.ReqContext) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteDeleteAlertingConfig(ctx)
}

func (f *ForkedAlertmanagerApi) forkRouteDeleteSilence(ctx *models.ReqContext) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteDeleteSilence(ctx)
}

func (f *ForkedAlertmanagerApi) forkRouteGetAlertingConfig(ctx *models.ReqContext) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetAlertingConfig(ctx)
}

func (f *ForkedAlertmanagerApi) forkRouteGetAMAlertGroups(ctx *models.ReqContext) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetAMAlertGroups(ctx)
}

func (f *ForkedAlertmanagerApi) forkRouteGetAMAlerts(ctx *models.ReqContext) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetAMAlerts(ctx)
}

func (f *ForkedAlertmanagerApi) forkRouteGetSilence(ctx *models.ReqContext) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetSilence(ctx)
}

func (f *ForkedAlertmanagerApi) forkRouteGetSilences(ctx *models.ReqContext) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetSilences(ctx)
}

func (f *ForkedAlertmanagerApi) forkRoutePostAlertingConfig(ctx *models.ReqContext, body apimodels.PostableUserConfig) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	b, err := backendType(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}

	if err := body.AlertmanagerConfig.ReceiverType().MatchesBackend(b); err != nil {
		return ErrResp(400, err, "bad match")
	}

	return s.RoutePostAlertingConfig(ctx, body)
}

func (f *ForkedAlertmanagerApi) forkRoutePostAMAlerts(ctx *models.ReqContext, body apimodels.PostableAlerts) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RoutePostAMAlerts(ctx, body)
}

func (f *ForkedAlertmanagerApi) forkRoutePostTestReceivers(ctx *models.ReqContext, body apimodels.TestReceiversConfigBodyParams) response.Response {
	s, err := f.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RoutePostTestReceivers(ctx, body)
}
