package api

// LOGZ.IO GRAFANA CHANGE :: DEV-30169,DEV-30170: add endpoints to evaluate and process alerts
import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/web"
	"net/http"
)

type LogzioAlertingApi struct {
	service *LogzioAlertingService
}

type RunAlertMigrationForOrg struct {
	OrgId              int64                             `json:"orgId"`
	EmailNotifications []AlertMigrationEmailNotification `json:"emailNotifications"`
}

type ClearOrgAlertMigration struct {
	OrgId int64 `json:"orgId"`
}

type AlertMigrationEmailNotification struct {
	EmailAddress string `json:"address"`
	ChannelUid   string `json:"channelUid"`
}

// NewLogzioAlertingApi creates a new LogzioAlertingApi instance
func NewLogzioAlertingApi(service *LogzioAlertingService) *LogzioAlertingApi {
	return &LogzioAlertingApi{
		service: service,
	}
}

func (api *LogzioAlertingApi) RouteEvaluateAlert(ctx *models.ReqContext) response.Response {
	body := apimodels.AlertEvaluationRequest{}
	if err := web.Bind(ctx.Req, &body); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return api.service.RouteEvaluateAlert(*ctx.Req, body)
}

func (api *LogzioAlertingApi) RouteProcessAlert(ctx *models.ReqContext) response.Response {
	body := apimodels.AlertProcessRequest{}
	if err := web.Bind(ctx.Req, &body); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return api.service.RouteProcessAlert(*ctx.Req, body)
}

func (api *LogzioAlertingApi) RouteMigrateOrg(ctx *models.ReqContext) response.Response {
	body := RunAlertMigrationForOrg{}

	if err := web.Bind(ctx.Req, &body); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return api.service.RouteMigrateOrg(body)
}

func (api *LogzioAlertingApi) RouteClearOrgMigration(ctx *models.ReqContext) response.Response {
	body := ClearOrgAlertMigration{}

	if err := web.Bind(ctx.Req, &body); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return api.service.RouteClearOrgMigration(body)
}

func (api *API) RegisterLogzioAlertingApiEndpoints(srv *LogzioAlertingApi, m *metrics.API) {
	api.RouteRegister.Group("", func(group routing.RouteRegister) {
		group.Post(
			toMacaronPath("/internal/alert/api/v1/eval"),
			metrics.Instrument(
				http.MethodPost,
				"/internal/alert/api/v1/eval",
				srv.RouteEvaluateAlert,
				m,
			),
		)
		group.Post(
			toMacaronPath("/internal/alert/api/v1/process"),
			metrics.Instrument(
				http.MethodPost,
				"/internal/alert/api/v1/process",
				srv.RouteProcessAlert,
				m,
			),
		)
		group.Post(
			toMacaronPath("/internal/alert/api/v1/migrate-org"),
			metrics.Instrument(
				http.MethodPost,
				"/internal/alert/api/v1/migrate-org",
				srv.RouteMigrateOrg,
				m,
			),
		)
		group.Post(
			toMacaronPath("/internal/alert/api/v1/clear-org-migration"),
			metrics.Instrument(
				http.MethodPost,
				"/internal/alert/api/v1/clear-org-migration",
				srv.RouteClearOrgMigration,
				m,
			),
		)
	})
}

// LOGZ.IO GRAFANA CHANGE :: end
