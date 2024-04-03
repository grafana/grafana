// LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add logzio notification route
// This is an implementation for the AlertsSender interface.
// This implementation sends all notifications to logzio api to handle the notifications.
// This is basically like external alertmanager datasource, only it isn't customer configurable and only for notification,
// The alertmanager data (configuration) is still managed internally

package sender

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"io"
	"net/http"
)

type LogzioAlertsRouter struct {
	logger log.Logger
	client *http.Client
	url    string
}

func NewLogzioAlertsRouter(alertsRouteUrl string) (*LogzioAlertsRouter, error) {
	//TODO: understand how to config httpclient and from where
	client := http.DefaultClient

	return &LogzioAlertsRouter{
		logger: log.New("ngalert.sender.logzio_router"),
		client: client,
		url:    alertsRouteUrl,
	}, nil
}

func (d *LogzioAlertsRouter) Send(ctx context.Context, key models.AlertRuleKey, alerts definitions.PostableAlerts) {
	logger := d.logger.New(key.LogContext()...)
	logger.Debug("Sending alerts on logzio sender")
	if len(alerts.PostableAlerts) == 0 {
		logger.Info("No alerts to notify about")
		return
	}
	// TODO: add relevant headers if needed? or remove if not
	headers := make(map[string]string)
	body := map[string]interface{}{
		"alertRuleKey": key,
		"alerts":       alerts,
	}

	payload, err := json.Marshal(body)
	if err != nil {
		logger.Error("Failed to marshal to json the alerts to send", "err", err)
		return
	}

	logger.Info("Sending alerts to external url", "url", d.url, "headers", headers, "payload", body)
	err = sendAlert(logger, ctx, d.client, d.url, payload, headers)
	if err != nil {
		logger.Warn("Error from sending alerts to notify", "err", err)
	}

}

func sendAlert(logger *log.ConcreteLogger, ctx context.Context, c *http.Client, url string, payload []byte, headers map[string]string) error {
	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Content-Type", contentTypeJSON)
	// Extension: set headers.
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	if url == "" {
		logger.Warn("No url provided for sending notifications")
	} else {
		resp, err := c.Do(req.WithContext(ctx))
		if err != nil {
			return err
		}
		defer func() {
			if _, err := io.Copy(io.Discard, resp.Body); err != nil {
				logger.Warn("error copy response body", "err", err)
			} else {
				if err := resp.Body.Close(); err != nil {
					logger.Warn("error closing response body", "err", err)
				}
			}
		}()

		// Any HTTP status 2xx is OK.
		if resp.StatusCode/100 != 2 {
			return fmt.Errorf("bad response status %s", resp.Status)
		}
	}

	return nil
}
