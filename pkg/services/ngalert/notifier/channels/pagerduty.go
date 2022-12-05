package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

const (
	pagerDutyEventTrigger = "trigger"
	pagerDutyEventResolve = "resolve"

	defaultSeverity = "critical"
)

var (
	knownSeverity        = map[string]struct{}{defaultSeverity: {}, "error": {}, "warning": {}, "info": {}}
	PagerdutyEventAPIURL = "https://events.pagerduty.com/v2/enqueue"
)

// PagerdutyNotifier is responsible for sending
// alert notifications to pagerduty
type PagerdutyNotifier struct {
	*Base
	tmpl     *template.Template
	log      log.Logger
	ns       notifications.WebhookSender
	images   ImageStore
	settings pagerdutySettings
}

type pagerdutySettings struct {
	Key           string `json:"integrationKey,omitempty" yaml:"integrationKey,omitempty"`
	Severity      string `json:"severity,omitempty" yaml:"severity,omitempty"`
	customDetails map[string]string
	Class         string `json:"class,omitempty" yaml:"class,omitempty"`
	Component     string `json:"component,omitempty" yaml:"component,omitempty"`
	Group         string `json:"group,omitempty" yaml:"group,omitempty"`
	Summary       string `json:"summary,omitempty" yaml:"summary,omitempty"`
}

func PagerdutyFactory(fc FactoryConfig) (NotificationChannel, error) {
	pdn, err := newPagerdutyNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return pdn, nil
}

// NewPagerdutyNotifier is the constructor for the PagerDuty notifier
func newPagerdutyNotifier(fc FactoryConfig) (*PagerdutyNotifier, error) {
	key := fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "integrationKey", fc.Config.Settings.Get("integrationKey").MustString())
	if key == "" {
		return nil, errors.New("could not find integration key property in settings")
	}

	return &PagerdutyNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
		}),
		tmpl:   fc.Template,
		log:    log.New("alerting.notifier." + fc.Config.Name),
		ns:     fc.NotificationService,
		images: fc.ImageStore,
		settings: pagerdutySettings{
			Key:      key,
			Severity: fc.Config.Settings.Get("severity").MustString(defaultSeverity),
			customDetails: map[string]string{
				"firing":       `{{ template "__text_alert_list" .Alerts.Firing }}`,
				"resolved":     `{{ template "__text_alert_list" .Alerts.Resolved }}`,
				"num_firing":   `{{ .Alerts.Firing | len }}`,
				"num_resolved": `{{ .Alerts.Resolved | len }}`,
			},
			Class:     fc.Config.Settings.Get("class").MustString("default"),
			Component: fc.Config.Settings.Get("component").MustString("Grafana"),
			Group:     fc.Config.Settings.Get("group").MustString("default"),
			Summary:   fc.Config.Settings.Get("summary").MustString(DefaultMessageTitleEmbed),
		},
	}, nil
}

// Notify sends an alert notification to PagerDuty
func (pn *PagerdutyNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	alerts := types.Alerts(as...)
	if alerts.Status() == model.AlertResolved && !pn.SendResolved() {
		pn.log.Debug("not sending a trigger to Pagerduty", "status", alerts.Status(), "auto resolve", pn.SendResolved())
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

	pn.log.Info("notifying Pagerduty", "event_type", eventType)
	cmd := &models.SendWebhookSync{
		Url:        PagerdutyEventAPIURL,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/json",
		},
	}
	if err := pn.ns.SendWebhookSync(ctx, cmd); err != nil {
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

	details := make(map[string]string, len(pn.settings.customDetails))
	for k, v := range pn.settings.customDetails {
		detail, err := pn.tmpl.ExecuteTextString(v, data)
		if err != nil {
			return nil, "", fmt.Errorf("%q: failed to template %q: %w", k, v, err)
		}
		details[k] = detail
	}

	severity := strings.ToLower(tmpl(pn.settings.Severity))
	if _, ok := knownSeverity[severity]; !ok {
		pn.log.Warn("Severity is not in the list of known values - using default severity", "actualSeverity", severity, "defaultSeverity", defaultSeverity)
		severity = defaultSeverity
	}

	msg := &pagerDutyMessage{
		Client:      "Grafana",
		ClientURL:   pn.tmpl.ExternalURL.String(),
		RoutingKey:  pn.settings.Key,
		EventAction: eventType,
		DedupKey:    key.Hash(),
		Links: []pagerDutyLink{{
			HRef: pn.tmpl.ExternalURL.String(),
			Text: "External URL",
		}},
		Payload: pagerDutyPayload{
			Component:     tmpl(pn.settings.Component),
			Summary:       tmpl(pn.settings.Summary),
			Severity:      severity,
			CustomDetails: details,
			Class:         tmpl(pn.settings.Class),
			Group:         tmpl(pn.settings.Group),
		},
	}

	_ = withStoredImages(ctx, pn.log, pn.images,
		func(_ int, image ngmodels.Image) error {
			if len(image.URL) != 0 {
				msg.Images = append(msg.Images, pagerDutyImage{Src: image.URL})
			}

			return nil
		},
		as...)

	if len(msg.Payload.Summary) > 1024 {
		// This is the Pagerduty limit.
		msg.Payload.Summary = msg.Payload.Summary[:1021] + "..."
	}

	if hostname, err := os.Hostname(); err == nil {
		// TODO: should this be configured like in Prometheus AM?
		msg.Payload.Source = hostname
	}

	if tmplErr != nil {
		pn.log.Warn("failed to template PagerDuty message", "error", tmplErr.Error())
	}

	return msg, eventType, nil
}

func (pn *PagerdutyNotifier) SendResolved() bool {
	return !pn.GetDisableResolveMessage()
}

type pagerDutyMessage struct {
	RoutingKey  string           `json:"routing_key,omitempty"`
	ServiceKey  string           `json:"service_key,omitempty"`
	DedupKey    string           `json:"dedup_key,omitempty"`
	EventAction string           `json:"event_action"`
	Payload     pagerDutyPayload `json:"payload"`
	Client      string           `json:"client,omitempty"`
	ClientURL   string           `json:"client_url,omitempty"`
	Links       []pagerDutyLink  `json:"links,omitempty"`
	Images      []pagerDutyImage `json:"images,omitempty"`
}

type pagerDutyLink struct {
	HRef string `json:"href"`
	Text string `json:"text"`
}

type pagerDutyImage struct {
	Src string `json:"src"`
}

type pagerDutyPayload struct {
	Summary       string            `json:"summary"`
	Source        string            `json:"source"`
	Severity      string            `json:"severity"`
	Class         string            `json:"class,omitempty"`
	Component     string            `json:"component,omitempty"`
	Group         string            `json:"group,omitempty"`
	CustomDetails map[string]string `json:"custom_details,omitempty"`
}
