package notifications

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	alertingHTTP "github.com/grafana/alerting/http"

	"github.com/grafana/grafana/pkg/util"
)

type Webhook struct {
	Url         string
	User        string
	Password    string
	Body        string
	HttpMethod  string
	HttpHeader  map[string]string
	ContentType string
	TLSConfig   *tls.Config

	// Validation is a function that will validate the response body and statusCode of the webhook. Any returned error will cause the webhook request to be considered failed.
	// This can be useful when a webhook service communicates failures in creative ways, such as using the response body instead of the status code.
	Validation func(body []byte, statusCode int) error
}

// WebhookClient exists to mock the client in tests.
type WebhookClient interface {
	Do(req *http.Request) (*http.Response, error)
}

func (ns *NotificationService) sendWebRequestSync(ctx context.Context, webhook *Webhook) error {
	if webhook.HttpMethod == "" {
		webhook.HttpMethod = http.MethodPost
	}

	ns.log.Debug("Sending webhook", "url", webhook.Url, "http method", webhook.HttpMethod)

	if webhook.HttpMethod != http.MethodPost && webhook.HttpMethod != http.MethodPut {
		return fmt.Errorf("webhook only supports HTTP methods PUT or POST")
	}

	request, err := http.NewRequestWithContext(ctx, webhook.HttpMethod, webhook.Url, bytes.NewReader([]byte(webhook.Body)))
	if err != nil {
		return err
	}
	url, err := url.Parse(webhook.Url)
	if err != nil {
		// Should not be possible - NewRequestWithContext should also err if the URL is bad.
		return err
	}

	if webhook.ContentType == "" {
		webhook.ContentType = "application/json"
	}

	request.Header.Set("Content-Type", webhook.ContentType)
	request.Header.Set("User-Agent", "Grafana")

	if webhook.User != "" && webhook.Password != "" {
		request.Header.Set("Authorization", util.GetBasicAuthHeader(webhook.User, webhook.Password))
	}

	for k, v := range webhook.HttpHeader {
		request.Header.Set(k, v)
	}

	resp, err := alertingHTTP.NewTLSClient(webhook.TLSConfig).Do(request)
	if err != nil {
		return redactURL(err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			ns.log.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if webhook.Validation != nil {
		err := webhook.Validation(body, resp.StatusCode)
		if err != nil {
			ns.log.Debug("Webhook failed validation", "url", url.Redacted(), "statuscode", resp.Status, "body", string(body), "error", err)
			return fmt.Errorf("webhook failed validation: %w", err)
		}
	}

	if resp.StatusCode/100 == 2 {
		ns.log.Debug("Webhook succeeded", "url", url.Redacted(), "statuscode", resp.Status)
		return nil
	}

	ns.log.Debug("Webhook failed", "url", url.Redacted(), "statuscode", resp.Status, "body", string(body))
	return fmt.Errorf("webhook response status %v", resp.Status)
}

func redactURL(err error) error {
	var e *url.Error
	if !errors.As(err, &e) {
		return err
	}
	e.URL = "<redacted>"
	return e
}
