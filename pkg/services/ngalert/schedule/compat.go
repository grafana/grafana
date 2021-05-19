package schedule

import (
	"time"

	"github.com/go-openapi/strfmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/prometheus/alertmanager/api/v2/models"

	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

func FromAlertStateToPostableAlerts(firingStates []*state.State, stateManager *state.Manager) apimodels.PostableAlerts {
	alerts := apimodels.PostableAlerts{PostableAlerts: make([]models.PostableAlert, 0, len(firingStates))}
	var sentAlerts []*state.State
	ts := time.Now()
	for _, alertState := range firingStates {
		if alertState.NeedsSending(stateManager.ResendDelay) {
			nL := alertState.Labels.Copy()
			if len(alertState.Results) > 0 {
				nL["__value__"] = alertState.Results[0].EvaluationString
			}
			alerts.PostableAlerts = append(alerts.PostableAlerts, models.PostableAlert{
				Annotations: alertState.Annotations,
				StartsAt:    strfmt.DateTime(alertState.StartsAt),
				EndsAt:      strfmt.DateTime(alertState.EndsAt),
				Alert: models.Alert{
					Labels: models.LabelSet(nL),
				},
			})
			alertState.LastSentAt = ts
			sentAlerts = append(sentAlerts, alertState)
		}
	}
	stateManager.Put(sentAlerts)
	return alerts
}
