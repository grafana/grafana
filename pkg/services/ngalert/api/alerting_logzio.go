package api

// LOGZ.IO GRAFANA CHANGE :: DEV-43895 (add endpoint to send alert notifications).
import (
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/setting"
	"net/http"
	"context"
	"time"
)

type LogzioAlertingService struct {
	Cfg                  *setting.Cfg
	EvaluatorFactory     eval.EvaluatorFactory
	Log                  log.Logger
	Schedule             schedule.ScheduleService
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager
}

func NewLogzioAlertingService(
	Cfg *setting.Cfg,
	EvaluatorFactory eval.EvaluatorFactory,
	log log.Logger,
	Schedule schedule.ScheduleService,
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager,
) *LogzioAlertingService {
	return &LogzioAlertingService{
		Cfg:                  Cfg,
		EvaluatorFactory:     EvaluatorFactory,
		Log:                  log,
		Schedule:             Schedule,
		MultiOrgAlertmanager: MultiOrgAlertmanager,
	}
}

func (srv *LogzioAlertingService) RouteEvaluateAlert(c *contextmodel.ReqContext, evalRequests []apimodels.AlertEvaluationRequest) response.Response {
	c.Logger.Info(fmt.Sprintf("Evaluate Alert API: got requests for %d evaluations", len(evalRequests)))

	var results []apimodels.AlertEvalRunResult

	for _, evalRequest := range evalRequests {
		c.Logger.Info("Evaluate Alert API", "eval_time", evalRequest.EvalTime, "rule_title", evalRequest.AlertRule.Title, "rule_uid", evalRequest.AlertRule.UID, "org_id", evalRequest.AlertRule.OrgID)

		evalReq := ngmodels.ExternalAlertEvaluationRequest{
			AlertRule:   evalRequest.AlertRule,
			EvalTime:    evalRequest.EvalTime,
			FolderTitle: evalRequest.FolderTitle,
			LogzHeaders: srv.addQuerySourceHeader(c),
		}

		var step = evalRequest.AlertRule.ID % 30

		time.AfterFunc(time.Duration(step * time.Second.Nanoseconds()), func() {
			srv.Schedule.RunRuleEvaluation(c.Req.Context(), evalReq)
		})

		results = append(results, apimodels.AlertEvalRunResult{UID: evalRequest.AlertRule.UID, EvalTime: evalRequest.EvalTime, RunResult: "success"})
	}

	c.Logger.Info("Evaluate Alert API - Done", "results", results)
	return response.JSON(http.StatusOK, apimodels.EvalRunsResponse{RunResults: results})
}

func (srv *LogzioAlertingService) addQuerySourceHeader(c *contextmodel.ReqContext) http.Header {
	requestHeaders := c.Req.Header.Clone()
	requestHeaders.Set("Query-Source", "METRICS_ALERTS")
	return requestHeaders
}

func (srv *LogzioAlertingService) RouteSendAlertNotifications(c *contextmodel.ReqContext, sendNotificationsRequest apimodels.AlertSendNotificationsRequest) response.Response {
	c.Logger.Info("Sending alerts to local notifier", "count", len(sendNotificationsRequest.Alerts.PostableAlerts))
	n, err := srv.MultiOrgAlertmanager.AlertmanagerFor(sendNotificationsRequest.AlertRuleKey.OrgID)
	if err == nil {
		if err := n.PutAlerts(c.Req.Context(), sendNotificationsRequest.Alerts); err != nil {
			c.Logger.Error("Failed to put alerts in the local notifier", "count", len(sendNotificationsRequest.Alerts.PostableAlerts), "error", err)
		} else {
			return response.Success("Put alerts was successful")
		}
	} else {
		if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) {
			c.Logger.Debug("Local notifier was not found")
		} else {
			c.Logger.Error("Local notifier is not available", "error", err)
		}
	}

	return response.Error(http.StatusInternalServerError, "Failed to put alerts", err)
}

// LOGZ.IO GRAFANA CHANGE :: end
