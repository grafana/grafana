package api

import (
	"fmt"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type ForkedAMSvc struct {
	AMSvc, GrafanaSvc AlertmanagerApiService
	DatasourceCache   datasources.CacheService
}

// NewForkedAM implements a set of routes that proxy to various Alertmanager-compatible backends.
func NewForkedAM(datasourceCache datasources.CacheService, proxy, grafana AlertmanagerApiService) *ForkedAMSvc {
	return &ForkedAMSvc{
		AMSvc:           proxy,
		GrafanaSvc:      grafana,
		DatasourceCache: datasourceCache,
	}
}

func (am *ForkedAMSvc) getService(ctx *models.ReqContext) (AlertmanagerApiService, error) {
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

func (am *ForkedAMSvc) RouteGetAMStatus(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteGetAMStatus(ctx)
}

func (am *ForkedAMSvc) RouteCreateSilence(ctx *models.ReqContext, body apimodels.PostableSilence) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteCreateSilence(ctx, body)
}

func (am *ForkedAMSvc) RouteDeleteAlertingConfig(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteDeleteAlertingConfig(ctx)
}

func (am *ForkedAMSvc) RouteDeleteSilence(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteDeleteSilence(ctx)
}

func (am *ForkedAMSvc) RouteGetAlertingConfig(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetAlertingConfig(ctx)
}

func (am *ForkedAMSvc) RouteGetAMAlertGroups(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetAMAlertGroups(ctx)
}

func (am *ForkedAMSvc) RouteGetAMAlerts(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetAMAlerts(ctx)
}

func (am *ForkedAMSvc) RouteGetSilence(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetSilence(ctx)
}

func (am *ForkedAMSvc) RouteGetSilences(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RouteGetSilences(ctx)
}

func (am *ForkedAMSvc) RoutePostAlertingConfig(ctx *models.ReqContext, body apimodels.PostableUserConfig) response.Response {
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

func (am *ForkedAMSvc) RoutePostAMAlerts(ctx *models.ReqContext, body apimodels.PostableAlerts) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RoutePostAMAlerts(ctx, body)
}

func (am *ForkedAMSvc) RoutePostTestReceivers(ctx *models.ReqContext, body apimodels.TestReceiversConfigParams) response.Response {
	s, err := am.getService(ctx)
	if err != nil {
		return ErrResp(400, err, "")
	}

	return s.RoutePostTestReceivers(ctx, body)
}
