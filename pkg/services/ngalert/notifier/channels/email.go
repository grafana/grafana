package channels

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
)

// EmailNotifier is responsible for sending
// alert notifications over email.
type EmailNotifier struct {
	old_notifiers.NotifierBase
	Addresses   []string
	SingleEmail bool
	log         log.Logger
	externalUrl *url.URL
}

// NewEmailNotifier is the constructor function
// for the EmailNotifier.
func NewEmailNotifier(model *models.AlertNotification) (*EmailNotifier, error) {
	addressesString := model.Settings.Get("addresses").MustString()
	singleEmail := model.Settings.Get("singleEmail").MustBool(false)

	if addressesString == "" {
		return nil, alerting.ValidationError{Reason: "Could not find addresses in settings"}
	}

	// split addresses with a few different ways
	addresses := util.SplitEmails(addressesString)

	// TODO: remove this URL hack and add an actual external URL.
	u, err := url.Parse("http://localhost")
	if err != nil {
		return nil, err
	}

	return &EmailNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(model),
		Addresses:    addresses,
		SingleEmail:  singleEmail,
		log:          log.New("alerting.notifier.email"),
		externalUrl:  u,
	}, nil
}

// Notify sends the alert notification.
func (en *EmailNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	// TODO(codesome): make sure the receiver name is added in the ctx before calling this.
	ctx = notify.WithReceiverName(ctx, "email-notification-channel") // Dummy.
	// TODO(codesome): make sure the group labels is added in the ctx before calling this.
	ctx = notify.WithGroupLabels(ctx, model.LabelSet{}) // Dummy.

	// We only need ExternalURL from this template object. This hack should go away with https://github.com/prometheus/alertmanager/pull/2508.
	data := notify.GetTemplateData(ctx, &template.Template{ExternalURL: en.externalUrl}, as, gokit_log.NewNopLogger())

	title := getTitleFromTemplateData(data)

	cmd := &models.SendEmailCommandSync{
		SendEmailCommand: models.SendEmailCommand{
			Subject: title,
			Data: map[string]interface{}{
				"Title":             title,
				"Receiver":          data.Receiver,
				"Status":            data.Status,
				"Alerts":            data.Alerts,
				"GroupLabels":       data.GroupLabels,
				"CommonLabels":      data.CommonLabels,
				"CommonAnnotations": data.CommonAnnotations,
				"ExternalURL":       data.ExternalURL,
				"RuleUrl":           "TODO",
				"AlertPageUrl":      "TODO",
			},
			To:          en.Addresses,
			SingleEmail: en.SingleEmail,
			Template:    "ng_alert_notification.html",
		},
	}

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		return false, err
	}

	return true, nil
}

func getTitleFromTemplateData(data *template.Data) string {
	title := "[" + data.Status
	if data.Status == string(model.AlertFiring) {
		title += fmt.Sprintf(":%d", len(data.Alerts.Firing()))
	}
	title += "] " + strings.Join(data.GroupLabels.SortedPairs().Values(), " ") + " "
	if len(data.CommonLabels) > len(data.GroupLabels) {
		title += "(" + strings.Join(data.CommonLabels.Remove(data.GroupLabels.Names()).Values(), " ") + ")"
	}
	return title
}

func (en *EmailNotifier) SendResolved() bool {
	// TODO: implement this.
	return true
}
