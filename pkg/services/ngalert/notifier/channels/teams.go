package channels

import (
	"context"
	"encoding/json"

	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

// TeamsNotifier is responsible for sending
// alert notifications to Microsoft teams.
type TeamsNotifier struct {
	*Base
	URL          string
	Message      string
	Title        string
	SectionTitle string
	tmpl         *template.Template
	log          log.Logger
	ns           notifications.WebhookSender
	images       ImageStore
}

type TeamsConfig struct {
	*NotificationChannelConfig
	URL          string
	Message      string
	Title        string
	SectionTitle string
}

func TeamsFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewTeamsConfig(fc.Config)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewTeamsNotifier(cfg, fc.NotificationService, fc.ImageStore, fc.Template), nil
}

func NewTeamsConfig(config *NotificationChannelConfig) (*TeamsConfig, error) {
	URL := config.Settings.Get("url").MustString()
	if URL == "" {
		return nil, errors.New("could not find url property in settings")
	}
	return &TeamsConfig{
		NotificationChannelConfig: config,
		URL:                       URL,
		Message:                   config.Settings.Get("message").MustString(`{{ template "teams.default.message" .}}`),
		Title:                     config.Settings.Get("title").MustString(DefaultMessageTitleEmbed),
		SectionTitle:              config.Settings.Get("sectiontitle").MustString(""),
	}, nil
}

type teamsImage struct {
	Image string `json:"image"`
}

// NewTeamsNotifier is the constructor for Teams notifier.
func NewTeamsNotifier(config *TeamsConfig, ns notifications.WebhookSender, images ImageStore, t *template.Template) *TeamsNotifier {
	return &TeamsNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		URL:          config.URL,
		Message:      config.Message,
		Title:        config.Title,
		SectionTitle: config.SectionTitle,
		log:          log.New("alerting.notifier.teams"),
		ns:           ns,
		images:       images,
		tmpl:         t,
	}
}

// Notify send an alert notification to Microsoft teams.
func (tn *TeamsNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	var tmplErr error
	tmpl, _ := TmplText(ctx, tn.tmpl, as, tn.log, &tmplErr)

	ruleURL := joinUrlPath(tn.tmpl.ExternalURL.String(), "/alerting/list", tn.log)

	var images []teamsImage
	_ = withStoredImages(ctx, tn.log, tn.images,
		func(_ int, image ngmodels.Image) error {
			if len(image.URL) != 0 {
				images = append(images, teamsImage{Image: image.URL})
			}
			return nil
		},
		as...)

	// Note: these template calls must remain in this order
	title := tmpl(tn.Title)
	sections := []map[string]interface{}{
		{
			"title": tmpl(tn.SectionTitle),
			"text":  tmpl(tn.Message),
		},
	}

	if len(images) != 0 {
		sections[0]["images"] = images
	}

	body := map[string]interface{}{
		"@type":    "MessageCard",
		"@context": "http://schema.org/extensions",
		// summary MUST not be empty or the webhook request fails
		// summary SHOULD contain some meaningful information, since it is used for mobile notifications
		"summary":    title,
		"title":      title,
		"themeColor": getAlertStatusColor(types.Alerts(as...).Status()),
		"sections":   sections,
		"potentialAction": []map[string]interface{}{
			{
				"@context": "http://schema.org",
				"@type":    "OpenUri",
				"name":     "View Rule",
				"targets": []map[string]interface{}{
					{
						"os":  "default",
						"uri": ruleURL,
					},
				},
			},
		},
	}

	if tmplErr != nil {
		tn.log.Warn("failed to template Teams message", "err", tmplErr.Error())
		tmplErr = nil
	}

	u := tmpl(tn.URL)
	if tmplErr != nil {
		tn.log.Warn("failed to template Teams URL", "err", tmplErr.Error(), "fallback", tn.URL)
		u = tn.URL
	}

	b, err := json.Marshal(&body)
	if err != nil {
		return false, errors.Wrap(err, "marshal json")
	}
	cmd := &models.SendWebhookSync{Url: u, Body: string(b)}

	// Teams does not always return non-2xx response when the request fails. Instead, the response body can contain an error message regardless of status code.
	// Ex. 429 - Too Many Requests: https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using?tabs=cURL#rate-limiting-for-connectors
	cmd.Validation = func(b []byte, statusCode int) error {
		body := string(b)

		// https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using?tabs=cURL#send-messages-using-curl-and-powershell
		// Above states that if the POST succeeds, you must see a simple "1" output.
		if body != "1" {
			return errors.New(body)
		}

		return nil
	}

	if err := tn.ns.SendWebhookSync(ctx, cmd); err != nil {
		return false, errors.Wrap(err, "send notification to Teams")
	}

	return true, nil
}

func (tn *TeamsNotifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}
