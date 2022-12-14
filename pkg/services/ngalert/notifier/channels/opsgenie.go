package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	ptr "github.com/xorcare/pointer"

	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	OpsgenieSendTags    = "tags"
	OpsgenieSendDetails = "details"
	OpsgenieSendBoth    = "both"
	// https://docs.opsgenie.com/docs/alert-api - 130 characters meaning runes.
	opsGenieMaxMessageLenRunes = 130
)

var (
	OpsgenieAlertURL = "https://api.opsgenie.com/v2/alerts"
	ValidPriorities  = map[string]bool{"P1": true, "P2": true, "P3": true, "P4": true, "P5": true}
)

// OpsgenieNotifier is responsible for sending alert notifications to Opsgenie.
type OpsgenieNotifier struct {
	*Base
	tmpl     *template.Template
	log      log.Logger
	ns       WebhookSender
	images   ImageStore
	settings *opsgenieSettings
}

type opsgenieSettings struct {
	APIKey           string
	APIUrl           string
	Message          string
	Description      string
	AutoClose        bool
	OverridePriority bool
	SendTagsAs       string
}

func buildOpsgenieSettings(fc FactoryConfig) (*opsgenieSettings, error) {
	type rawSettings struct {
		APIKey           string `json:"apiKey,omitempty" yaml:"apiKey,omitempty"`
		APIUrl           string `json:"apiUrl,omitempty" yaml:"apiUrl,omitempty"`
		Message          string `json:"message,omitempty" yaml:"message,omitempty"`
		Description      string `json:"description,omitempty" yaml:"description,omitempty"`
		AutoClose        *bool  `json:"autoClose,omitempty" yaml:"autoClose,omitempty"`
		OverridePriority *bool  `json:"overridePriority,omitempty" yaml:"overridePriority,omitempty"`
		SendTagsAs       string `json:"sendTagsAs,omitempty" yaml:"sendTagsAs,omitempty"`
	}

	raw := rawSettings{}
	err := fc.Config.unmarshalSettings(&raw)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	raw.APIKey = fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "apiKey", raw.APIKey)
	if raw.APIKey == "" {
		return nil, errors.New("could not find api key property in settings")
	}
	if raw.APIUrl == "" {
		raw.APIUrl = OpsgenieAlertURL
	}

	if strings.TrimSpace(raw.Message) == "" {
		raw.Message = DefaultMessageTitleEmbed
	}

	switch raw.SendTagsAs {
	case OpsgenieSendTags, OpsgenieSendDetails, OpsgenieSendBoth:
	case "":
		raw.SendTagsAs = OpsgenieSendTags
	default:
		return nil, fmt.Errorf("invalid value for sendTagsAs: %q", raw.SendTagsAs)
	}

	if raw.AutoClose == nil {
		raw.AutoClose = ptr.Bool(true)
	}
	if raw.OverridePriority == nil {
		raw.OverridePriority = ptr.Bool(true)
	}

	return &opsgenieSettings{
		APIKey:           raw.APIKey,
		APIUrl:           raw.APIUrl,
		Message:          raw.Message,
		Description:      raw.Description,
		AutoClose:        *raw.AutoClose,
		OverridePriority: *raw.OverridePriority,
		SendTagsAs:       raw.SendTagsAs,
	}, nil
}

func OpsgenieFactory(fc FactoryConfig) (NotificationChannel, error) {
	notifier, err := NewOpsgenieNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return notifier, nil
}

// NewOpsgenieNotifier is the constructor for the Opsgenie notifier
func NewOpsgenieNotifier(fc FactoryConfig) (*OpsgenieNotifier, error) {
	settings, err := buildOpsgenieSettings(fc)
	if err != nil {
		return nil, err
	}
	return &OpsgenieNotifier{
		Base:     NewBase(fc.Config.UID, fc.Config.Name, fc.Config.Type, false, fc.Config.DisableResolveMessage),
		tmpl:     fc.Template,
		log:      log.New("alerting.notifier.opsgenie"),
		ns:       fc.NotificationService,
		images:   fc.ImageStore,
		settings: settings,
	}, nil
}

// Notify sends an alert notification to Opsgenie
func (on *OpsgenieNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	on.log.Debug("executing Opsgenie notification", "notification", on.Name)

	alerts := types.Alerts(as...)
	if alerts.Status() == model.AlertResolved && !on.SendResolved() {
		on.log.Debug("not sending a trigger to Opsgenie", "status", alerts.Status(), "auto resolve", on.SendResolved())
		return true, nil
	}

	body, url, err := on.buildOpsgenieMessage(ctx, alerts, as)
	if err != nil {
		return false, fmt.Errorf("build Opsgenie message: %w", err)
	}

	if url == "" {
		// Resolved alert with no auto close.
		// Hence skip sending anything.
		return true, nil
	}

	cmd := &SendWebhookSettings{
		Url:        url,
		Body:       string(body),
		HttpMethod: http.MethodPost,
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("GenieKey %s", on.settings.APIKey),
		},
	}

	if err := on.ns.SendWebhook(ctx, cmd); err != nil {
		return false, fmt.Errorf("send notification to Opsgenie: %w", err)
	}

	return true, nil
}

func (on *OpsgenieNotifier) buildOpsgenieMessage(ctx context.Context, alerts model.Alerts, as []*types.Alert) (payload []byte, apiURL string, err error) {
	key, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return nil, "", err
	}

	if alerts.Status() == model.AlertResolved {
		// For resolved notification, we only need the source.
		// Don't need to run other templates.
		if !on.settings.AutoClose { // TODO This should be handled by DisableResolveMessage?
			return nil, "", nil
		}
		msg := opsGenieCloseMessage{
			Source: "Grafana",
		}
		data, err := json.Marshal(msg)
		apiURL = fmt.Sprintf("%s/%s/close?identifierType=alias", on.settings.APIUrl, key.Hash())
		return data, apiURL, err
	}

	ruleURL := joinUrlPath(on.tmpl.ExternalURL.String(), "/alerting/list", on.log)

	var tmplErr error
	tmpl, data := TmplText(ctx, on.tmpl, as, on.log, &tmplErr)

	message, truncated := TruncateInRunes(tmpl(on.settings.Message), opsGenieMaxMessageLenRunes)
	if truncated {
		on.log.Warn("Truncated message", "alert", key, "max_runes", opsGenieMaxMessageLenRunes)
	}

	description := tmpl(on.settings.Description)
	if strings.TrimSpace(description) == "" {
		description = fmt.Sprintf(
			"%s\n%s\n\n%s",
			tmpl(DefaultMessageTitleEmbed),
			ruleURL,
			tmpl(DefaultMessageEmbed),
		)
	}

	var priority string

	// In the new alerting system we've moved away from the grafana-tags. Instead, annotations on the rule itself should be used.
	lbls := make(map[string]string, len(data.CommonLabels))
	for k, v := range data.CommonLabels {
		lbls[k] = tmpl(v)
		if k == "og_priority" && on.settings.OverridePriority {
			if ValidPriorities[v] {
				priority = v
			}
		}
	}

	// Check for templating errors
	if tmplErr != nil {
		on.log.Warn("failed to template Opsgenie message", "error", tmplErr.Error())
		tmplErr = nil
	}

	details := make(map[string]interface{})
	details["url"] = ruleURL
	if on.sendDetails() {
		for k, v := range lbls {
			details[k] = v
		}
		var images []string
		_ = withStoredImages(ctx, on.log, on.images,
			func(_ int, image Image) error {
				if len(image.URL) == 0 {
					return nil
				}
				images = append(images, image.URL)
				return nil
			},
			as...)

		if len(images) != 0 {
			details["image_urls"] = images
		}
	}

	tags := make([]string, 0, len(lbls))
	if on.sendTags() {
		for k, v := range lbls {
			tags = append(tags, fmt.Sprintf("%s:%s", k, v))
		}
	}
	sort.Strings(tags)

	result := opsGenieCreateMessage{
		Alias:       key.Hash(),
		Description: description,
		Tags:        tags,
		Source:      "Grafana",
		Message:     message,
		Details:     details,
		Priority:    priority,
	}

	apiURL = tmpl(on.settings.APIUrl)
	if tmplErr != nil {
		on.log.Warn("failed to template Opsgenie URL", "error", tmplErr.Error(), "fallback", on.settings.APIUrl)
		apiURL = on.settings.APIUrl
	}

	b, err := json.Marshal(result)
	return b, apiURL, err
}

func (on *OpsgenieNotifier) SendResolved() bool {
	return !on.GetDisableResolveMessage()
}

func (on *OpsgenieNotifier) sendDetails() bool {
	return on.settings.SendTagsAs == OpsgenieSendDetails || on.settings.SendTagsAs == OpsgenieSendBoth
}

func (on *OpsgenieNotifier) sendTags() bool {
	return on.settings.SendTagsAs == OpsgenieSendTags || on.settings.SendTagsAs == OpsgenieSendBoth
}

type opsGenieCreateMessage struct {
	Alias       string                           `json:"alias"`
	Message     string                           `json:"message"`
	Description string                           `json:"description,omitempty"`
	Details     map[string]interface{}           `json:"details"`
	Source      string                           `json:"source"`
	Responders  []opsGenieCreateMessageResponder `json:"responders,omitempty"`
	Tags        []string                         `json:"tags"`
	Note        string                           `json:"note,omitempty"`
	Priority    string                           `json:"priority,omitempty"`
	Entity      string                           `json:"entity,omitempty"`
	Actions     []string                         `json:"actions,omitempty"`
}

type opsGenieCreateMessageResponder struct {
	ID       string `json:"id,omitempty"`
	Name     string `json:"name,omitempty"`
	Username string `json:"username,omitempty"`
	Type     string `json:"type"` // team, user, escalation, schedule etc.
}

type opsGenieCloseMessage struct {
	Source string `json:"source"`
}
