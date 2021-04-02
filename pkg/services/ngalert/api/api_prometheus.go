package api

import (
	"net/http"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type PrometheusSrv struct {
	log          log.Logger
	stateTracker *state.StateTracker
}

func (srv PrometheusSrv) RouteGetAlertStatuses(c *models.ReqContext) response.Response {
	alertResponse := apimodels.AlertResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.AlertDiscovery{
			Alerts: []*apimodels.Alert{},
		},
	}
	for _, alertState := range srv.stateTracker.GetAll() {
		startsAt := alertState.StartsAt
		alertResponse.Data.Alerts = append(alertResponse.Data.Alerts, &apimodels.Alert{
			Labels:      map[string]string(alertState.Labels),
			Annotations: map[string]string{}, //TODO: Once annotations are added to the evaluation result, set them here
			State:       alertState.State.String(),
			ActiveAt:    &startsAt,
			Value:       "", //TODO: once the result of the evaluation is added to the evaluation result, set it here
		})
	}
	return response.JSON(http.StatusOK, alertResponse)
}

func (srv PrometheusSrv) RouteGetRuleStatuses(c *models.ReqContext) response.Response {
	recipient := c.Params(":Recipient")
	srv.log.Info("RouteGetRuleStatuses: ", "Recipient", recipient)
	return response.Error(http.StatusNotImplemented, "", nil)
}
