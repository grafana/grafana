package channels

import (
	"context"
	"fmt"
	"path"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/services/ngalert/logging"
	"github.com/grafana/grafana/pkg/util"
)

// EmailNotifier is responsible for sending
// alert notifications over email.
type EmailNotifier struct {
	old_notifiers.NotifierBase
	Addresses   []string
	SingleEmail bool
	Message     string
	log         log.Logger
	tmpl        *template.Template
}

// NewEmailNotifier is the constructor function
// for the EmailNotifier.
func NewEmailNotifier(model *NotificationChannelConfig, t *template.Template) (*EmailNotifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	addressesString := model.Settings.Get("addresses").MustString()
	singleEmail := model.Settings.Get("singleEmail").MustBool(false)

	if addressesString == "" {
		return nil, alerting.ValidationError{Reason: "Could not find addresses in settings"}
	}

	// split addresses with a few different ways
	addresses := util.SplitEmails(addressesString)

	return &EmailNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		Addresses:   addresses,
		SingleEmail: singleEmail,
		Message:     model.Settings.Get("message").MustString(),
		log:         log.New("alerting.notifier.email"),
		tmpl:        t,
	}, nil
}

// Notify sends the alert notification.
func (en *EmailNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	// We only need ExternalURL from this template object. This hack should go away with https://github.com/prometheus/alertmanager/pull/2508.
	data := notify.GetTemplateData(ctx, &template.Template{ExternalURL: en.tmpl.ExternalURL}, as, gokit_log.NewLogfmtLogger(logging.NewWrapper(en.log)))
	var tmplErr error
	tmpl := notify.TmplText(en.tmpl, data, &tmplErr)

	title := tmpl(`{{ template "default.title" . }}`)

	cmd := &models.SendEmailCommandSync{
		SendEmailCommand: models.SendEmailCommand{
			Subject: title,
			Data: map[string]interface{}{
				"Title":             title,
				"Message":           tmpl(en.Message),
				"Status":            data.Status,
				"Alerts":            data.Alerts,
				"GroupLabels":       data.GroupLabels,
				"CommonLabels":      data.CommonLabels,
				"CommonAnnotations": data.CommonAnnotations,
				"ExternalURL":       data.ExternalURL,
				"RuleUrl":           path.Join(en.tmpl.ExternalURL.String(), "/alerting/list"),
				"AlertPageUrl":      path.Join(en.tmpl.ExternalURL.String(), "/alerting/list?alertState=firing&view=state"),
			},
			To:          en.Addresses,
			SingleEmail: en.SingleEmail,
			Template:    "ng_alert_notification.html",
		},
	}

	if tmplErr != nil {
		return false, fmt.Errorf("failed to template email message: %w", tmplErr)
	}

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		return false, err
	}

	return true, nil
}

func (en *EmailNotifier) SendResolved() bool {
	return !en.GetDisableResolveMessage()
}
