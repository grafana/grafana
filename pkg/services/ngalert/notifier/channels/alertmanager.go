package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

// GetDecryptedValueFn is a function that returns the decrypted value of
// the given key. If the key is not present, then it returns the fallback value.
type GetDecryptedValueFn func(ctx context.Context, sjd map[string][]byte, key string, fallback string) string

type AlertmanagerConfig struct {
	*NotificationChannelConfig
	URLs              []*url.URL
	BasicAuthUser     string
	BasicAuthPassword string
}

func NewAlertmanagerConfig(config *NotificationChannelConfig, fn GetDecryptedValueFn) (*AlertmanagerConfig, error) {
	urlStr := config.Settings.Get("url").MustString()
	if urlStr == "" {
		return nil, errors.New("could not find url property in settings")
	}
	var urls []*url.URL
	for _, uS := range strings.Split(urlStr, ",") {
		uS = strings.TrimSpace(uS)
		if uS == "" {
			continue
		}
		uS = strings.TrimSuffix(uS, "/") + "/api/v1/alerts"
		url, err := url.Parse(uS)
		if err != nil {
			return nil, fmt.Errorf("invalid url property in settings: %w", err)
		}
		urls = append(urls, url)
	}
	return &AlertmanagerConfig{
		NotificationChannelConfig: config,
		URLs:                      urls,
		BasicAuthUser:             config.Settings.Get("basicAuthUser").MustString(),
		BasicAuthPassword:         fn(context.Background(), config.SecureSettings, "basicAuthPassword", config.Settings.Get("basicAuthPassword").MustString()),
	}, nil
}

func AlertmanagerFactory(fc FactoryConfig) (NotificationChannel, error) {
	config, err := NewAlertmanagerConfig(fc.Config, fc.DecryptFunc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewAlertmanagerNotifier(config, nil, fc.DecryptFunc), nil
}

// NewAlertmanagerNotifier returns a new Alertmanager notifier.
func NewAlertmanagerNotifier(config *AlertmanagerConfig, _ *template.Template, fn GetDecryptedValueFn) *AlertmanagerNotifier {
	return &AlertmanagerNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		urls:              config.URLs,
		basicAuthUser:     config.BasicAuthUser,
		basicAuthPassword: config.BasicAuthPassword,
		logger:            log.New("alerting.notifier.prometheus-alertmanager"),
	}
}

// AlertmanagerNotifier sends alert notifications to the alert manager
type AlertmanagerNotifier struct {
	*Base

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

	var (
		lastErr error
		numErrs int
	)
	for _, u := range n.urls {
		if _, err := sendHTTPRequest(ctx, u, httpCfg{
			user:     n.basicAuthUser,
			password: n.basicAuthPassword,
			body:     body,
		}, n.logger); err != nil {
			n.logger.Warn("Failed to send to Alertmanager", "error", err, "alertmanager", n.Name, "url", u.String())
			lastErr = err
			numErrs++
		}
	}

	if numErrs == len(n.urls) {
		// All attempts to send alerts have failed
		n.logger.Warn("All attempts to send to Alertmanager failed", "alertmanager", n.Name)
		return false, fmt.Errorf("failed to send alert to Alertmanager: %w", lastErr)
	}

	return true, nil
}

func (n *AlertmanagerNotifier) SendResolved() bool {
	return !n.GetDisableResolveMessage()
}
