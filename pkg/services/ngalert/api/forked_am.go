package api

import (
	"fmt"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type ForkedAMSvc struct {
	AmSvc, GrafanaSvc AlertmanagerApiService
	DatasourceCache   datasources.CacheService
}

func NewForkedAM(datasourceCache datasources.CacheService, proxy, grafana AlertmanagerApiService) *ForkedAMSvc {
	return &ForkedAMSvc{
		AmSvc:           proxy,
		GrafanaSvc:      grafana,
		DatasourceCache: datasourceCache,
	}
}

func (am *ForkedAMSvc) RouteCreateSilence(ctx *models.ReqContext, body apimodels.SilenceBody) response.Response {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc.RouteCreateSilence(ctx, body)
	case apimodels.AlertmanagerBackend:
		return am.AmSvc.RouteCreateSilence(ctx, body)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (am *ForkedAMSvc) RouteDeleteAlertingConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc.RouteDeleteAlertingConfig(ctx)
	case apimodels.AlertmanagerBackend:
		return am.AmSvc.RouteDeleteAlertingConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (am *ForkedAMSvc) RouteDeleteSilence(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc.RouteDeleteSilence(ctx)
	case apimodels.AlertmanagerBackend:
		return am.AmSvc.RouteDeleteSilence(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (am *ForkedAMSvc) RouteGetAlertingConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc.RouteGetAlertingConfig(ctx)
	case apimodels.AlertmanagerBackend:
		return am.AmSvc.RouteGetAlertingConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (am *ForkedAMSvc) RouteGetAmAlertGroups(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc.RouteGetAmAlertGroups(ctx)
	case apimodels.AlertmanagerBackend:
		return am.AmSvc.RouteGetAmAlertGroups(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (am *ForkedAMSvc) RouteGetAmAlerts(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc.RouteGetAmAlerts(ctx)
	case apimodels.AlertmanagerBackend:
		return am.AmSvc.RouteGetAmAlerts(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (am *ForkedAMSvc) RouteGetSilence(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc.RouteGetSilence(ctx)
	case apimodels.AlertmanagerBackend:
		return am.AmSvc.RouteGetSilence(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (am *ForkedAMSvc) RouteGetSilences(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc.RouteGetSilences(ctx)
	case apimodels.AlertmanagerBackend:
		return am.AmSvc.RouteGetSilences(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (am *ForkedAMSvc) RoutePostAlertingConfig(ctx *models.ReqContext, body apimodels.PostableUserConfig) response.Response {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc.RoutePostAlertingConfig(ctx, body)
	case apimodels.AlertmanagerBackend:
		return am.AmSvc.RoutePostAlertingConfig(ctx, body)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (am *ForkedAMSvc) RoutePostAmAlerts(ctx *models.ReqContext, body apimodels.PostableAlerts) response.Response {
	t, err := backendType(ctx, am.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}

	switch t {
	case apimodels.GrafanaBackend:
		return am.GrafanaSvc.RoutePostAmAlerts(ctx, body)
	case apimodels.AlertmanagerBackend:
		return am.AmSvc.RoutePostAmAlerts(ctx, body)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}
