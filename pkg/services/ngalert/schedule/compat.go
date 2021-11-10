package schedule

import (
	"fmt"
	"net/url"
	"path"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/prometheus/alertmanager/api/v2/models"

	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

func FromAlertStateToPostableAlerts(firingStates []*state.State, stateManager *state.Manager, appURL *url.URL) apimodels.PostableAlerts {
	alerts := apimodels.PostableAlerts{PostableAlerts: make([]models.PostableAlert, 0, len(firingStates))}
	var sentAlerts []*state.State
	ts := time.Now()

	for _, alertState := range firingStates {
		if !alertState.NeedsSending(stateManager.ResendDelay) {
			continue
		}
		nL := alertState.Labels.Copy()
		nA := data.Labels(alertState.Annotations).Copy()

		if len(alertState.Results) > 0 {
			nA["__value_string__"] = alertState.Results[0].EvaluationString
		}

		var urlStr string
		if uid := nL[ngModels.RuleUIDLabel]; len(uid) > 0 && appURL != nil {
			u := *appURL
			u.Path = path.Join(u.Path, fmt.Sprintf("/alerting/%s/edit", uid))
			urlStr = u.String()
		} else if appURL != nil {
			urlStr = appURL.String()
		} else {
			urlStr = ""
		}

		alerts.PostableAlerts = append(alerts.PostableAlerts, models.PostableAlert{
			Annotations: models.LabelSet(nA),
			StartsAt:    strfmt.DateTime(alertState.StartsAt),
			EndsAt:      strfmt.DateTime(alertState.EndsAt),
			Alert: models.Alert{
				Labels:       models.LabelSet(nL),
				GeneratorURL: strfmt.URI(urlStr),
			},
		})
		alertState.LastSentAt = ts
		sentAlerts = append(sentAlerts, alertState)
	}
	stateManager.Put(sentAlerts)
	return alerts
}
