package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

// NewAlertmanagerNotifier returns a new Alertmanager notifier.
func NewAlertmanagerNotifier(model *NotificationChannelConfig, t *template.Template) (*AlertmanagerNotifier, error) {
	if model.Settings == nil {
		return nil, receiverInitError{Reason: "no settings supplied"}
	}

	urlStr := model.Settings.Get("url").MustString()
	if urlStr == "" {
		return nil, receiverInitError{Reason: "could not find url property in settings", Cfg: *model}
	}

	var urls []*url.URL
	for _, uS := range strings.Split(urlStr, ",") {
		uS = strings.TrimSpace(uS)
		if uS == "" {
			continue
		}

		uS = strings.TrimSuffix(uS, "/") + "/api/v1/alerts"
		u, err := url.Parse(uS)
		if err != nil {
			return nil, receiverInitError{Reason: "invalid url property in settings", Cfg: *model, Err: err}
		}

		urls = append(urls, u)
	}
	basicAuthUser := model.Settings.Get("basicAuthUser").MustString()
	basicAuthPassword := model.DecryptedValue("basicAuthPassword", model.Settings.Get("basicAuthPassword").MustString())

	return &AlertmanagerNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		urls:              urls,
		basicAuthUser:     basicAuthUser,
		basicAuthPassword: basicAuthPassword,
		logger:            log.New("alerting.notifier.prometheus-alertmanager"),
	}, nil
}

// AlertmanagerNotifier sends alert notifications to the alert manager
type AlertmanagerNotifier struct {
	old_notifiers.NotifierBase

	urls              []*url.URL
	basicAuthUser     string
	basicAuthPassword string
	logger            log.Logger
}

// Notify sends alert notifications to Alertmanager.
func (n *AlertmanagerNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	n.logger.Debug("Sending Alertmanager alert", "alertmanager", n.Name)
	if len(as) == 0 {
		return true, nil
	}

	body, err := json.Marshal(as)
	if err != nil {
		return false, err
	}

	errCnt := 0
	for _, u := range n.urls {
		if _, err := sendHTTPRequest(ctx, u, httpCfg{
			user:     n.basicAuthUser,
			password: n.basicAuthPassword,
			body:     body,
		}, n.logger); err != nil {
			n.logger.Warn("Failed to send to Alertmanager", "error", err, "alertmanager", n.Name, "url", u.String())
			errCnt++
		}
	}

	if errCnt == len(n.urls) {
		// All attempts to send alerts have failed
		n.logger.Warn("All attempts to send to Alertmanager failed", "alertmanager", n.Name)
		return false, fmt.Errorf("failed to send alert to Alertmanager")
	}

	return true, nil
}

func (n *AlertmanagerNotifier) SendResolved() bool {
	return !n.GetDisableResolveMessage()
}
