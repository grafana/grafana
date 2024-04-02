package api

// LOGZ.IO GRAFANA CHANGE :: DEV-43895 (add endpoint to send alert notifications).
import (
	"errors"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"net/http"
)

type LogzioAlertingService struct {
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager
}

func NewLogzioAlertingService(
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager,
) *LogzioAlertingService {
	return &LogzioAlertingService{
		MultiOrgAlertmanager: MultiOrgAlertmanager,
	}
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
