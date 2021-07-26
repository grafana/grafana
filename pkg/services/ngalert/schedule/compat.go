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

	"github.com/grafana/grafana/pkg/infra/log"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

func FromAlertStateToPostableAlerts(logger log.Logger, firingStates []*state.State, stateManager *state.Manager, appURL string) apimodels.PostableAlerts {
	alerts := apimodels.PostableAlerts{PostableAlerts: make([]models.PostableAlert, 0, len(firingStates))}
	var sentAlerts []*state.State
	ts := time.Now()

	u, err := url.Parse(appURL)
	if err != nil {
		logger.Debug("failed to parse URL while joining URL", "url", appURL, "err", err.Error())
		u = nil
	}

	for _, alertState := range firingStates {
		if alertState.NeedsSending(stateManager.ResendDelay) {
			nL := alertState.Labels.Copy()
			nA := data.Labels(alertState.Annotations).Copy()

			if len(alertState.Results) > 0 {
				nA["__value_string__"] = alertState.Results[0].EvaluationString
			}

			genURL := appURL
			if uid := nL[ngModels.RuleUIDLabel]; len(uid) > 0 && u != nil {
				oldPath := u.Path
				u.Path = path.Join(u.Path, fmt.Sprintf("/alerting/%s/edit", uid))
				genURL = u.String()
				u.Path = oldPath
			}

			alerts.PostableAlerts = append(alerts.PostableAlerts, models.PostableAlert{
				Annotations: models.LabelSet(nA),
				StartsAt:    strfmt.DateTime(alertState.StartsAt),
				EndsAt:      strfmt.DateTime(alertState.EndsAt),
				Alert: models.Alert{
					Labels:       models.LabelSet(nL),
					GeneratorURL: strfmt.URI(genURL),
				},
			})
			alertState.LastSentAt = ts
			sentAlerts = append(sentAlerts, alertState)
		}
	}
	stateManager.Put(sentAlerts)
	return alerts
}
