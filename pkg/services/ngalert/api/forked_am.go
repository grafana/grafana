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

func (am *ForkedAlertmanagerApi) getService(ctx *models.ReqContext) (AlertmanagerApiService, error) {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return nil, err
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc, nil
	case apimodels.AlertmanagerBackend:
		return am.AMSvc, nil
	default:
		return nil, fmt.Errorf("unexpected backend type (%v)", t)
	}
}

func (am *ForkedAlertmanagerApi) forkRouteGetAMStatus(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteGetAMStatus(ctx)
}

func (am *ForkedAlertmanagerApi) forkRouteCreateSilence(ctx *models.ReqContext, body apimodels.PostableSilence) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteCreateSilence(ctx, body)
}

func (am *ForkedAlertmanagerApi) forkRouteDeleteAlertingConfig(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteDeleteAlertingConfig(ctx)
}

func (am *ForkedAlertmanagerApi) forkRouteDeleteSilence(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteDeleteSilence(ctx)
}

func (am *ForkedAlertmanagerApi) forkRouteGetAlertingConfig(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetAlertingConfig(ctx)
}

func (am *ForkedAlertmanagerApi) forkRouteGetAMAlertGroups(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetAMAlertGroups(ctx)
}

func (am *ForkedAlertmanagerApi) forkRouteGetAMAlerts(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetAMAlerts(ctx)
}

func (am *ForkedAlertmanagerApi) forkRouteGetSilence(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetSilence(ctx)
}

func (am *ForkedAlertmanagerApi) forkRouteGetSilences(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetSilences(ctx)
}

func (am *ForkedAlertmanagerApi) forkRoutePostAlertingConfig(ctx *models.ReqContext, body apimodels.PostableUserConfig) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	b, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}

	if err := body.AlertmanagerConfig.ReceiverType().MatchesBackend(b); err != nil {
		return ErrResp(400, err, "bad match")
	}

	return s.RoutePostAlertingConfig(ctx, body)
}

func (am *ForkedAlertmanagerApi) forkRoutePostAMAlerts(ctx *models.ReqContext, body apimodels.PostableAlerts) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RoutePostAMAlerts(ctx, body)
}

func (am *ForkedAlertmanagerApi) forkRoutePostTestReceivers(ctx *models.ReqContext, body apimodels.TestReceiversConfigBodyParams) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RoutePostTestReceivers(ctx, body)
}
