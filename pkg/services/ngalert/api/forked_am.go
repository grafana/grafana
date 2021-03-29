package api

import (
	"fmt"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type ForkedAMSvc struct {
	AMSvc, GrafanaSvc AlertmanagerApiService
	DatasourceCache   datasources.CacheService
}

func NewForkedAM(datasourceCache datasources.CacheService, proxy, grafana AlertmanagerApiService) *ForkedAMSvc {
	return &ForkedAMSvc{
		AMSvc:           proxy,
		GrafanaSvc:      grafana,
		DatasourceCache: datasourceCache,
	}
}

func (am *ForkedAMSvc) getService(ctx *models.ReqContext, datasourceCache datasources.CacheService) (AlertmanagerApiService, error) {
	t, err := backendType(ctx, datasourceCache)
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

func (am *ForkedAMSvc) RouteCreateSilence(ctx *models.ReqContext, body apimodels.SilenceBody) response.Response {
	s, err := am.getService(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteCreateSilence(ctx, body)
}

func (am *ForkedAMSvc) RouteDeleteAlertingConfig(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteDeleteAlertingConfig(ctx)
}

func (am *ForkedAMSvc) RouteDeleteSilence(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteDeleteSilence(ctx)
}

func (am *ForkedAMSvc) RouteGetAlertingConfig(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteGetAlertingConfig(ctx)
}

func (am *ForkedAMSvc) RouteGetAmAlertGroups(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteGetAmAlertGroups(ctx)
}

func (am *ForkedAMSvc) RouteGetAmAlerts(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteGetAmAlerts(ctx)
}

func (am *ForkedAMSvc) RouteGetSilence(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteGetSilence(ctx)
}

func (am *ForkedAMSvc) RouteGetSilences(ctx *models.ReqContext) response.Response {
	s, err := am.getService(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RouteGetSilences(ctx)
}

func (am *ForkedAMSvc) RoutePostAlertingConfig(ctx *models.ReqContext, body apimodels.PostableUserConfig) response.Response {
	s, err := am.getService(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RoutePostAlertingConfig(ctx, body)
}

func (am *ForkedAMSvc) RoutePostAmAlerts(ctx *models.ReqContext, body apimodels.PostableAlerts) response.Response {
	s, err := am.getService(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	return s.RoutePostAmAlerts(ctx, body)
}
