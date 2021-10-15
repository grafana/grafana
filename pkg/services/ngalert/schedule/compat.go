package schedule

import (
	"fmt"
	"net/url"
	"path"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/common/model"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

const (
	NoDataAlertName = "DatasourceNoData"

	OriginalAlertName = "original_alertname"
)

// stateToPostableAlert converts an state to a model that is accepted by Alertmanager. Annotations and Labels are copied from the state.
// - if state has at least one result, a new label '__value_string__' is added to the label set
// - the alert's GeneratorURL is constructed to point to the alert edit page
// - if evaluation state is either NoData or Error, the resulting set of labels is changed:
//   - original alert name (label: model.AlertNameLabel) is backed up to OriginalAlertName
//   - label model.AlertNameLabel is overwritten to either NoDataAlertName or ErrorAlertName
func stateToPostableAlert(alertState *state.State, appURL *url.URL) *models.PostableAlert {
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

	if alertState.State == eval.NoData {
		if name, ok := nL[model.AlertNameLabel]; ok {
			nL[OriginalAlertName] = name
		}
		nL[model.AlertNameLabel] = NoDataAlertName
	}

	return &models.PostableAlert{
		Annotations: models.LabelSet(nA),
		StartsAt:    strfmt.DateTime(alertState.StartsAt),
		EndsAt:      strfmt.DateTime(alertState.EndsAt),
		Alert: models.Alert{
			Labels:       models.LabelSet(nL),
			GeneratorURL: strfmt.URI(urlStr),
		},
	}
}

func FromAlertStateToPostableAlerts(firingStates []*state.State, stateManager *state.Manager, appURL *url.URL) apimodels.PostableAlerts {
	alerts := apimodels.PostableAlerts{PostableAlerts: make([]models.PostableAlert, 0, len(firingStates))}
	var sentAlerts []*state.State
	ts := time.Now()

	for _, alertState := range firingStates {
		if !alertState.NeedsSending(stateManager.ResendDelay) {
			continue
		}
		alert := stateToPostableAlert(alertState, appURL)
		alerts.PostableAlerts = append(alerts.PostableAlerts, *alert)
		alertState.LastSentAt = ts
		sentAlerts = append(sentAlerts, alertState)
	}
	stateManager.Put(sentAlerts)
	return alerts
}
