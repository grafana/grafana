package channels

import (
	"context"
	"encoding/json"
	"path"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/services/ngalert/logging"
)

// TeamsNotifier is responsible for sending
// alert notifications to Microsoft teams.
type TeamsNotifier struct {
	old_notifiers.NotifierBase
	URL     string
	Message string
	tmpl    *template.Template
	log     log.Logger
}

// NewTeamsNotifier is the constructor for Teams notifier.
func NewTeamsNotifier(model *NotificationChannelConfig, t *template.Template) (*TeamsNotifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	u := model.Settings.Get("url").MustString()
	if u == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	return &TeamsNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		URL:     u,
		Message: model.Settings.Get("message").MustString(`{{ template "default.message" .}}`),
		log:     log.New("alerting.notifier.teams"),
		tmpl:    t,
	}, nil
}

// Notify send an alert notification to Microsoft teams.
func (tn *TeamsNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	data := notify.GetTemplateData(ctx, tn.tmpl, as, gokit_log.NewLogfmtLogger(logging.NewWrapper(tn.log)))
	var tmplErr error
	tmpl := notify.TmplText(tn.tmpl, data, &tmplErr)

	title := tmpl(`{{ template "default.title" . }}`)
	body := map[string]interface{}{
		"@type":    "MessageCard",
		"@context": "http://schema.org/extensions",
		// summary MUST not be empty or the webhook request fails
		// summary SHOULD contain some meaningful information, since it is used for mobile notifications
		"summary":    title,
		"title":      title,
		"themeColor": getAlertStatusColor(types.Alerts(as...).Status()),
		"sections": []map[string]interface{}{
			{
				"title": "Details",
				"text":  tmpl(tn.Message),
			},
		},
		"potentialAction": []map[string]interface{}{
			{
				"@context": "http://schema.org",
				"@type":    "OpenUri",
				"name":     "View Rule",
				"targets": []map[string]interface{}{
					{
						"os":  "default",
						"uri": path.Join(tn.tmpl.ExternalURL.String(), "/alerting/list"),
					},
				},
			},
		},
	}

	if tmplErr != nil {
		return false, errors.Wrap(tmplErr, "failed to template Teams message")
	}

	b, err := json.Marshal(&body)
	if err != nil {
		return false, errors.Wrap(err, "marshal json")
	}
	cmd := &models.SendWebhookSync{Url: tn.URL, Body: string(b)}

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		return false, errors.Wrap(err, "send notification to Teams")
	}

	return true, nil
}

func (tn *TeamsNotifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}
