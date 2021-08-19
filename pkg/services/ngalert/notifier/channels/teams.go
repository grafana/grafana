package channels

import (
	"context"
	"encoding/json"

	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
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
		return nil, receiverInitError{Cfg: *model, Reason: "no settings supplied"}
	}

	u := model.Settings.Get("url").MustString()
	if u == "" {
		return nil, receiverInitError{Cfg: *model, Reason: "could not find url property in settings"}
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
		Message: model.Settings.Get("message").MustString(`{{ template "teams.default.message" .}}`),
		log:     log.New("alerting.notifier.teams"),
		tmpl:    t,
	}, nil
}

// Notify send an alert notification to Microsoft teams.
func (tn *TeamsNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	var tmplErr error
	tmpl, _ := TmplText(ctx, tn.tmpl, as, tn.log, &tmplErr)

	ruleURL := joinUrlPath(tn.tmpl.ExternalURL.String(), "/alerting/list", tn.log)

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
						"uri": ruleURL,
					},
				},
			},
		},
	}

	u := tmpl(tn.URL)
	if tmplErr != nil {
		tn.log.Debug("failed to template Teams message", "err", tmplErr.Error())
	}

	b, err := json.Marshal(&body)
	if err != nil {
		return false, errors.Wrap(err, "marshal json")
	}
	cmd := &models.SendWebhookSync{Url: u, Body: string(b)}

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		return false, errors.Wrap(err, "send notification to Teams")
	}

	return true, nil
}

func (tn *TeamsNotifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}
