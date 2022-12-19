package channels

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	LineNotifyURL string = "https://notify-api.line.me/api/notify"
)

// LineNotifier is responsible for sending
// alert notifications to LINE.
type LineNotifier struct {
	*Base
	log      Logger
	ns       WebhookSender
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
	settings, err := simplejson.NewJson(fc.Config.Settings)
	if err != nil {
		return nil, err
	}
	token := fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "token", settings.Get("token").MustString())
	if token == "" {
		return nil, errors.New("could not find token in settings")
	}
	title := settings.Get("title").MustString(DefaultMessageTitleEmbed)
	description := settings.Get("description").MustString(DefaultMessageEmbed)

	return &LineNotifier{
		Base:     NewBase(fc.Config),
		log:      fc.Logger,
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

	cmd := &SendWebhookSettings{
		Url:        LineNotifyURL,
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Authorization": fmt.Sprintf("Bearer %s", ln.settings.token),
			"Content-Type":  "application/x-www-form-urlencoded;charset=UTF-8",
		},
		Body: form.Encode(),
	}

	if err := ln.ns.SendWebhook(ctx, cmd); err != nil {
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
