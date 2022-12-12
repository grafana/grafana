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
	defaultClass    = "default"
	defaultGroup    = "default"
	defaultClient   = "Grafana"
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
	settings *pagerdutySettings
}

type pagerdutySettings struct {
	Key           string `json:"integrationKey,omitempty" yaml:"integrationKey,omitempty"`
	Severity      string `json:"severity,omitempty" yaml:"severity,omitempty"`
	customDetails map[string]string
	Class         string `json:"class,omitempty" yaml:"class,omitempty"`
	Component     string `json:"component,omitempty" yaml:"component,omitempty"`
	Group         string `json:"group,omitempty" yaml:"group,omitempty"`
	Summary       string `json:"summary,omitempty" yaml:"summary,omitempty"`
	Source        string `json:"source,omitempty" yaml:"source,omitempty"`
	Client        string `json:"client,omitempty" yaml:"client,omitempty"`
	ClientURL     string `json:"client_url,omitempty" yaml:"client_url,omitempty"`
}

func buildPagerdutySettings(fc FactoryConfig) (*pagerdutySettings, error) {
	settings := pagerdutySettings{}
	err := fc.Config.unmarshalSettings(&settings)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	settings.Key = fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "integrationKey", settings.Key)
	if settings.Key == "" {
		return nil, errors.New("could not find integration key property in settings")
	}

	settings.customDetails = map[string]string{
		"firing":       `{{ template "__text_alert_list" .Alerts.Firing }}`,
		"resolved":     `{{ template "__text_alert_list" .Alerts.Resolved }}`,
		"num_firing":   `{{ .Alerts.Firing | len }}`,
		"num_resolved": `{{ .Alerts.Resolved | len }}`,
	}

	if settings.Severity == "" {
		settings.Severity = defaultSeverity
	}
	if settings.Class == "" {
		settings.Class = defaultClass
	}
	if settings.Component == "" {
		settings.Component = "Grafana"
	}
	if settings.Group == "" {
		settings.Group = defaultGroup
	}
	if settings.Summary == "" {
		settings.Summary = DefaultMessageTitleEmbed
	}
	if settings.Client == "" {
		settings.Client = defaultClient
	}
	if settings.ClientURL == "" {
		settings.ClientURL = "{{ .ExternalURL }}"
	}
	if settings.Source == "" {
		source, err := os.Hostname()
		if err != nil {
			source = settings.Client
		}
		settings.Source = source
	}
	return &settings, nil
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
	settings, err := buildPagerdutySettings(fc)
	if err != nil {
		return nil, err
	}

	return &PagerdutyNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
		}),
		tmpl:     fc.Template,
		log:      fc.Logger,
		ns:       fc.NotificationService,
		images:   fc.ImageStore,
		settings: settings,
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

	pn.log.Info("Sending notification", "event_type", eventType)
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
		Client:      tmpl(pn.settings.Client),
		ClientURL:   tmpl(pn.settings.ClientURL),
		RoutingKey:  pn.settings.Key,
		EventAction: eventType,
		DedupKey:    key.Hash(),
		Links: []pagerDutyLink{{
			HRef: pn.tmpl.ExternalURL.String(),
			Text: "External URL",
		}},
		Payload: pagerDutyPayload{
			Source:        tmpl(pn.settings.Source),
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

	if summary, truncated := notify.Truncate(msg.Payload.Summary, 1024); truncated {
		pn.log.Debug("Truncated summary", "original", msg.Payload.Summary)
		msg.Payload.Summary = summary
	}

	if tmplErr != nil {
		pn.log.Warn("Failed to template PagerDuty message", "error", tmplErr.Error())
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
