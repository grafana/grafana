package state

import (
	"encoding/json"
	"fmt"
	"net/url"
	"path"
	"strconv"

	"github.com/benbjohnson/clock"
	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/common/model"

	alertingModels "github.com/grafana/alerting/models"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	NoDataAlertName = "DatasourceNoData"
	ErrorAlertName  = "DatasourceError"

	Rulename = "rulename"
)

// StateToPostableAlert converts a state to a model that is accepted by Alertmanager. Annotations and Labels are copied from the state.
// - if state has at least one result, a new label '__value_string__' is added to the label set
// - the alert's GeneratorURL is constructed to point to the alert detail view
// - if evaluation state is either NoData or Error, the resulting set of labels is changed:
//   - original alert name (label: model.AlertNameLabel) is backed up to OriginalAlertName
//   - label model.AlertNameLabel is overwritten to either NoDataAlertName or ErrorAlertName
func StateToPostableAlert(transition StateTransition, appURL *url.URL) *models.PostableAlert {
	alertState := transition.State
	nL := alertState.Labels.Copy()
	nA := data.Labels(alertState.Annotations).Copy()

	// encode the values as JSON where it will be expanded later
	if len(alertState.Values) > 0 {
		if b, err := json.Marshal(alertState.Values); err == nil {
			nA[alertingModels.ValuesAnnotation] = string(b)
		}
	}

	if alertState.LastEvaluationString != "" {
		nA[alertingModels.ValueStringAnnotation] = alertState.LastEvaluationString
	}

	if alertState.Image != nil {
		attachImageAnnotations(alertState.Image, nA)
	}

	if alertState.StateReason != "" {
		nA[alertingModels.StateReasonAnnotation] = alertState.StateReason
	}

	if alertState.OrgID != 0 {
		nA[alertingModels.OrgIDAnnotation] = strconv.FormatInt(alertState.OrgID, 10)
	}

	var urlStr string
	if uid := nL[alertingModels.RuleUIDLabel]; len(uid) > 0 && appURL != nil {
		u := *appURL
		u.Path = path.Join(u.Path, fmt.Sprintf("/alerting/grafana/%s/view", uid))
		urlStr = u.String()
	} else if appURL != nil {
		urlStr = appURL.String()
	} else {
		urlStr = ""
	}

	state := alertState.State
	if alertState.ResolvedAt != nil {
		// If this is a resolved alert, we need to send an alert with the correct labels such that they will expire the previous alert.
		// In most cases the labels on the state will be correct, however when the previous alert was a NoData or Error alert, we need to
		// ensure to modify it appropriately.
		state = transition.PreviousState
	}

	if state == eval.NoData {
		return noDataAlert(nL, nA, alertState, urlStr)
	}

	if state == eval.Error {
		return errorAlert(nL, nA, alertState, urlStr)
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

// NoDataAlert is a special alert sent by Grafana to the Alertmanager, that indicates we received no data from the datasource.
// It effectively replaces the legacy behavior of "Keep Last State" by separating the regular alerting flow from the no data scenario into a separate alerts.
// The Alert is defined as:
// {  alertname=DatasourceNoData rulename=original_alertname } + { rule labelset } + { rule annotations }
func noDataAlert(labels data.Labels, annotations data.Labels, alertState *State, urlStr string) *models.PostableAlert {
	if name, ok := labels[model.AlertNameLabel]; ok {
		labels[Rulename] = name
	}
	labels[model.AlertNameLabel] = NoDataAlertName

	return &models.PostableAlert{
		Annotations: models.LabelSet(annotations),
		StartsAt:    strfmt.DateTime(alertState.StartsAt),
		EndsAt:      strfmt.DateTime(alertState.EndsAt),
		Alert: models.Alert{
			Labels:       models.LabelSet(labels),
			GeneratorURL: strfmt.URI(urlStr),
		},
	}
}

// errorAlert is a special alert sent when evaluation of an alert rule failed due to an error. Like noDataAlert, it
// replaces the old behaviour of "Keep Last State" creating a separate alert called DatasourceError.
func errorAlert(labels, annotations data.Labels, alertState *State, urlStr string) *models.PostableAlert {
	if name, ok := labels[model.AlertNameLabel]; ok {
		labels[Rulename] = name
	}
	labels[model.AlertNameLabel] = ErrorAlertName

	return &models.PostableAlert{
		Annotations: models.LabelSet(annotations),
		StartsAt:    strfmt.DateTime(alertState.StartsAt),
		EndsAt:      strfmt.DateTime(alertState.EndsAt),
		Alert: models.Alert{
			Labels:       models.LabelSet(labels),
			GeneratorURL: strfmt.URI(urlStr),
		},
	}
}

// FromAlertsStateToStoppedAlert selects only transitions from firing states (states eval.Alerting, eval.NoData, eval.Error)
// and converts them to models.PostableAlert with EndsAt set to time.Now
func FromAlertsStateToStoppedAlert(firingStates []StateTransition, appURL *url.URL, clock clock.Clock) apimodels.PostableAlerts {
	alerts := apimodels.PostableAlerts{PostableAlerts: make([]models.PostableAlert, 0, len(firingStates))}
	ts := clock.Now()
	for _, transition := range firingStates {
		if transition.PreviousState == eval.Normal || transition.PreviousState == eval.Pending {
			continue
		}
		postableAlert := StateToPostableAlert(transition, appURL)
		postableAlert.EndsAt = strfmt.DateTime(ts)
		alerts.PostableAlerts = append(alerts.PostableAlerts, *postableAlert)
	}
	return alerts
}

// attachImageAnnotations attaches image annotations to the alert.
func attachImageAnnotations(image *ngModels.Image, a data.Labels) {
	if image.Token != "" {
		a[alertingModels.ImageTokenAnnotation] = image.Token
	}
	if image.URL != "" {
		a[alertingModels.ImageURLAnnotation] = image.URL
	}
}
