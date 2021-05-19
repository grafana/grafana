package channels

import (
	"context"
	"fmt"
	"net/url"
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
)

const (
	LineNotifyURL string = "https://notify-api.line.me/api/notify"
)

// NewLineNotifier is the constructor for the LINE notifier
func NewLineNotifier(model *NotificationChannelConfig, t *template.Template) (*LineNotifier, error) {
	token := model.DecryptedValue("token", model.Settings.Get("token").MustString())
	if token == "" {
		return nil, alerting.ValidationError{Reason: "Could not find token in settings"}
	}

	return &LineNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		Token: token,
		log:   log.New("alerting.notifier.line"),
		tmpl:  t,
	}, nil
}

// LineNotifier is responsible for sending
// alert notifications to LINE.
type LineNotifier struct {
	old_notifiers.NotifierBase
	Token string
	log   log.Logger
	tmpl  *template.Template
}

// Notify send an alert notification to LINE
func (ln *LineNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	ln.log.Debug("Executing line notification", "notification", ln.Name)

	ruleURL := path.Join(ln.tmpl.ExternalURL.String(), "/alerting/list")

	data := notify.GetTemplateData(ctx, ln.tmpl, as, gokit_log.NewNopLogger())
	var tmplErr error
	tmpl := notify.TmplText(ln.tmpl, data, &tmplErr)

	body := fmt.Sprintf(
		"%s\n%s\n\n%s",
		tmpl(`{{ template "default.title" . }}`),
		ruleURL,
		tmpl(`{{ template "default.message" . }}`),
	)
	if tmplErr != nil {
		return false, fmt.Errorf("failed to template Line message: %w", tmplErr)
	}

	form := url.Values{}
	form.Add("message", body)

	cmd := &models.SendWebhookSync{
		Url:        LineNotifyURL,
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Authorization": fmt.Sprintf("Bearer %s", ln.Token),
			"Content-Type":  "application/x-www-form-urlencoded;charset=UTF-8",
		},
		Body: form.Encode(),
	}

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		ln.log.Error("Failed to send notification to LINE", "error", err, "body", body)
		return false, err
	}

	return true, nil
}

func (ln *LineNotifier) SendResolved() bool {
	return !ln.GetDisableResolveMessage()
}
