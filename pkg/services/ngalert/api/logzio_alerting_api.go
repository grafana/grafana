package api

// LOGZ.IO GRAFANA CHANGE :: DEV-43895 (add endpoint to send alert notifications).
import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/web"
	"net/http"
)

type LogzioAlertingApi struct {
	service *LogzioAlertingService
}

// NewLogzioAlertingApi creates a new LogzioAlertingApi instance
func NewLogzioAlertingApi(service *LogzioAlertingService) *LogzioAlertingApi {
	return &LogzioAlertingApi{
		service: service,
	}
}

func (api *API) RegisterLogzioAlertingApiEndpoints(srv *LogzioAlertingApi, m *metrics.API) {
	api.RouteRegister.Group("", func(group routing.RouteRegister) {
		group.Post(
			toMacaronPath("/internal/alert/api/v1/send-notifications"),
			metrics.Instrument(
				http.MethodPost,
				"/internal/alert/api/v1/send-notifications",
				srv.RouteSendAlertNotifications,
				m,
			),
		)
	})
}

func (api *LogzioAlertingApi) RouteSendAlertNotifications(ctx *contextmodel.ReqContext) response.Response {
	body := apimodels.AlertSendNotificationsRequest{}
	if err := web.Bind(ctx.Req, &body); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return api.service.RouteSendAlertNotifications(ctx, body)
}

// LOGZ.IO GRAFANA CHANGE :: end
