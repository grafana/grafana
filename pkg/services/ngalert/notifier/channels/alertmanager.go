package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/alerting/alerting/notifier/channels"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
)

type AlertmanagerConfig struct {
	*channels.NotificationChannelConfig
	URLs              []*url.URL
	BasicAuthUser     string
	BasicAuthPassword string
}

type alertmanagerSettings struct {
	URLs     []*url.URL
	User     string
	Password string
}

func AlertmanagerFactory(fc channels.FactoryConfig) (channels.NotificationChannel, error) {
	ch, err := buildAlertmanagerNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return ch, nil
}

func buildAlertmanagerNotifier(fc channels.FactoryConfig) (*AlertmanagerNotifier, error) {
	var settings struct {
		URL      channels.CommaSeparatedStrings `json:"url,omitempty" yaml:"url,omitempty"`
		User     string                         `json:"basicAuthUser,omitempty" yaml:"basicAuthUser,omitempty"`
		Password string                         `json:"basicAuthPassword,omitempty" yaml:"basicAuthPassword,omitempty"`
	}
	err := json.Unmarshal(fc.Config.Settings, &settings)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	urls := make([]*url.URL, 0, len(settings.URL))
	for _, uS := range settings.URL {
		uS = strings.TrimSpace(uS)
		if uS == "" {
			continue
		}
		uS = strings.TrimSuffix(uS, "/") + "/api/v1/alerts"
		u, err := url.Parse(uS)
		if err != nil {
			return nil, fmt.Errorf("invalid url property in settings: %w", err)
		}
		urls = append(urls, u)
	}
	if len(settings.URL) == 0 || len(urls) == 0 {
		return nil, errors.New("could not find url property in settings")
	}
	settings.Password = fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "basicAuthPassword", settings.Password)

	return &AlertmanagerNotifier{
		Base:   channels.NewBase(fc.Config),
		images: fc.ImageStore,
		settings: alertmanagerSettings{
			URLs:     urls,
			User:     settings.User,
			Password: settings.Password,
		},
		logger: fc.Logger,
	}, nil
}

// AlertmanagerNotifier sends alert notifications to the alert manager
type AlertmanagerNotifier struct {
	*channels.Base
	images   channels.ImageStore
	settings alertmanagerSettings
	logger   channels.Logger
}

// Notify sends alert notifications to Alertmanager.
func (n *AlertmanagerNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	n.logger.Debug("sending Alertmanager alert", "alertmanager", n.Name)
	if len(as) == 0 {
		return true, nil
	}

	_ = withStoredImages(ctx, n.logger, n.images,
		func(index int, image channels.Image) error {
			// If there is an image for this alert and the image has been uploaded
			// to a public URL then include it as an annotation
			if image.URL != "" {
				as[index].Annotations["image"] = model.LabelValue(image.URL)
			}
			return nil
		}, as...)

	body, err := json.Marshal(as)
	if err != nil {
		return false, err
	}

	var (
		lastErr error
		numErrs int
	)
	for _, u := range n.settings.URLs {
		if _, err := sendHTTPRequest(ctx, u, httpCfg{
			user:     n.settings.User,
			password: n.settings.Password,
			body:     body,
		}, n.logger); err != nil {
			n.logger.Warn("failed to send to Alertmanager", "error", err, "alertmanager", n.Name, "url", u.String())
			lastErr = err
			numErrs++
		}
	}

	if numErrs == len(n.settings.URLs) {
		// All attempts to send alerts have failed
		n.logger.Warn("all attempts to send to Alertmanager failed", "alertmanager", n.Name)
		return false, fmt.Errorf("failed to send alert to Alertmanager: %w", lastErr)
	}

	return true, nil
}

func (n *AlertmanagerNotifier) SendResolved() bool {
	return !n.GetDisableResolveMessage()
}
