package channels

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

var (
	LineNotifyURL string = "https://notify-api.line.me/api/notify"
)

// LineNotifier is responsible for sending
// alert notifications to LINE.
type LineNotifier struct {
	*Base
	log      log.Logger
	ns       notifications.WebhookSender
	tmpl     *template.Template
	settings lineSettings
}

type lineSettings struct {
	token       string
	title       string
	description string
}

func LineFactory(fc FactoryConfig) (NotificationChannel, error) {
	n, err := newLineNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return n, nil
}

// newLineNotifier is the constructor for the LINE notifier
func newLineNotifier(fc FactoryConfig) (*LineNotifier, error) {
	token := fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "token", fc.Config.Settings.Get("token").MustString())
	if token == "" {
		return nil, errors.New("could not find token in settings")
	}
	title := fc.Config.Settings.Get("title").MustString(DefaultMessageTitleEmbed)
	description := fc.Config.Settings.Get("description").MustString(DefaultMessageEmbed)

	return &LineNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
		}),
		log:      log.New("alerting.notifier.line"),
		ns:       fc.NotificationService,
		tmpl:     fc.Template,
		settings: lineSettings{token: token, title: title, description: description},
	}, nil
}

// Notify send an alert notification to LINE
func (ln *LineNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	ln.log.Debug("executing line notification", "notification", ln.Name)

	body := ln.buildMessage(ctx, as...)

	form := url.Values{}
	form.Add("message", body)

	cmd := &models.SendWebhookSync{
		Url:        LineNotifyURL,
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Authorization": fmt.Sprintf("Bearer %s", ln.settings.token),
			"Content-Type":  "application/x-www-form-urlencoded;charset=UTF-8",
		},
		Body: form.Encode(),
	}

	if err := ln.ns.SendWebhookSync(ctx, cmd); err != nil {
		ln.log.Error("failed to send notification to LINE", "error", err, "body", body)
		return false, err
	}

	return true, nil
}

func (ln *LineNotifier) SendResolved() bool {
	return !ln.GetDisableResolveMessage()
}

func (ln *LineNotifier) buildMessage(ctx context.Context, as ...*types.Alert) string {
	ruleURL := path.Join(ln.tmpl.ExternalURL.String(), "/alerting/list")

	var tmplErr error
	tmpl, _ := TmplText(ctx, ln.tmpl, as, ln.log, &tmplErr)

	body := fmt.Sprintf(
		"%s\n%s\n\n%s",
		tmpl(ln.settings.title),
		ruleURL,
		tmpl(ln.settings.description),
	)
	if tmplErr != nil {
		ln.log.Warn("failed to template Line message", "error", tmplErr.Error())
	}
	return body
}
