package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
)

const (
	pagerDutyEventTrigger = "trigger"
	pagerDutyEventResolve = "resolve"
)

var (
	PagerdutyEventAPIURL = "https://events.pagerduty.com/v2/enqueue"
)

// PagerdutyNotifier is responsible for sending
// alert notifications to pagerduty
type PagerdutyNotifier struct {
	old_notifiers.NotifierBase
	Key           string
	Severity      string
	CustomDetails map[string]string
	Class         string
	Component     string
	Group         string
	Summary       string
	tmpl          *template.Template
	log           log.Logger
}

// NewPagerdutyNotifier is the constructor for the PagerDuty notifier
func NewPagerdutyNotifier(model *NotificationChannelConfig, t *template.Template) (*PagerdutyNotifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	key := model.DecryptedValue("integrationKey", model.Settings.Get("integrationKey").MustString())
	if key == "" {
		return nil, alerting.ValidationError{Reason: "Could not find integration key property in settings"}
	}

	return &PagerdutyNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		Key: key,
		CustomDetails: map[string]string{
			"firing":       `{{ template "__text_alert_list" .Alerts.Firing }}`,
			"resolved":     `{{ template "__text_alert_list" .Alerts.Resolved }}`,
			"num_firing":   `{{ .Alerts.Firing | len }}`,
			"num_resolved": `{{ .Alerts.Resolved | len }}`,
		},
		Severity:  model.Settings.Get("severity").MustString("critical"),
		Class:     model.Settings.Get("class").MustString("default"),
		Component: model.Settings.Get("component").MustString("Grafana"),
		Group:     model.Settings.Get("group").MustString("default"),
		Summary:   model.Settings.Get("summary").MustString(`{{ template "default.title" . }}`),
		tmpl:      t,
		log:       log.New("alerting.notifier." + model.Name),
	}, nil
}

// Notify sends an alert notification to PagerDuty
func (pn *PagerdutyNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	alerts := types.Alerts(as...)
	if alerts.Status() == model.AlertResolved && !pn.SendResolved() {
		pn.log.Debug("Not sending a trigger to Pagerduty", "status", alerts.Status(), "auto resolve", pn.SendResolved())
		return true, nil
	}

	msg, eventType, err := pn.buildPagerdutyMessage(ctx, alerts, as)
	if err != nil {
		return false, fmt.Errorf("build pagerduty message: %w", err)
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return false, fmt.Errorf("marshal json: %w", err)
	}

	pn.log.Info("Notifying Pagerduty", "event_type", eventType)
	cmd := &models.SendWebhookSync{
		Url:        PagerdutyEventAPIURL,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/json",
		},
	}
	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		return false, fmt.Errorf("send notification to Pagerduty: %w", err)
	}

	return true, nil
}

func (pn *PagerdutyNotifier) buildPagerdutyMessage(ctx context.Context, alerts model.Alerts, as []*types.Alert) (*pagerDutyMessage, string, error) {
	key, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return nil, "", err
	}

	eventType := pagerDutyEventTrigger
	if alerts.Status() == model.AlertResolved {
		eventType = pagerDutyEventResolve
	}

	var tmplErr error
	tmpl, data := TmplText(ctx, pn.tmpl, as, pn.log, &tmplErr)

	details := make(map[string]string, len(pn.CustomDetails))
	for k, v := range pn.CustomDetails {
		detail, err := pn.tmpl.ExecuteTextString(v, data)
		if err != nil {
			return nil, "", fmt.Errorf("%q: failed to template %q: %w", k, v, err)
		}
		details[k] = detail
	}

	msg := &pagerDutyMessage{
		Client:      "Grafana",
		ClientURL:   pn.tmpl.ExternalURL.String(),
		RoutingKey:  pn.Key,
		EventAction: eventType,
		DedupKey:    key.Hash(),
		Links: []pagerDutyLink{{
			HRef: pn.tmpl.ExternalURL.String(),
			Text: "External URL",
		}},
		Description: tmpl(`{{ template "default.title" . }}`), // TODO: this can be configurable template.
		Payload: &pagerDutyPayload{
			Component:     tmpl(pn.Component),
			Summary:       tmpl(pn.Summary),
			Severity:      tmpl(pn.Severity),
			CustomDetails: details,
			Class:         tmpl(pn.Class),
			Group:         tmpl(pn.Group),
		},
	}

	if len(msg.Payload.Summary) > 1024 {
		// This is the Pagerduty limit.
		msg.Payload.Summary = msg.Payload.Summary[:1021] + "..."
	}

	if hostname, err := os.Hostname(); err == nil {
		// TODO: should this be configured like in Prometheus AM?
		msg.Payload.Source = hostname
	}

	if tmplErr != nil {
		pn.log.Debug("failed to template PagerDuty message", "err", tmplErr.Error())
	}

	return msg, eventType, nil
}

func (pn *PagerdutyNotifier) SendResolved() bool {
	return !pn.GetDisableResolveMessage()
}

type pagerDutyMessage struct {
	RoutingKey  string            `json:"routing_key,omitempty"`
	ServiceKey  string            `json:"service_key,omitempty"`
	DedupKey    string            `json:"dedup_key,omitempty"`
	IncidentKey string            `json:"incident_key,omitempty"`
	EventType   string            `json:"event_type,omitempty"`
	Description string            `json:"description,omitempty"`
	EventAction string            `json:"event_action"`
	Payload     *pagerDutyPayload `json:"payload"`
	Client      string            `json:"client,omitempty"`
	ClientURL   string            `json:"client_url,omitempty"`
	Details     map[string]string `json:"details,omitempty"`
	Links       []pagerDutyLink   `json:"links,omitempty"`
}

type pagerDutyLink struct {
	HRef string `json:"href"`
	Text string `json:"text"`
}

type pagerDutyPayload struct {
	Summary       string            `json:"summary"`
	Source        string            `json:"source"`
	Severity      string            `json:"severity"`
	Timestamp     string            `json:"timestamp,omitempty"`
	Class         string            `json:"class,omitempty"`
	Component     string            `json:"component,omitempty"`
	Group         string            `json:"group,omitempty"`
	CustomDetails map[string]string `json:"custom_details,omitempty"`
}
