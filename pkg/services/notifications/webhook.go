package notifications

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

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

	// Validation is a function that will validate the response body and statusCode of the webhook. Any returned error will cause the webhook request to be considered failed.
	// This can be useful when a webhook service communicates failures in creative ways, such as using the response body instead of the status code.
	Validation func(body []byte, statusCode int) error
}

// WebhookClient exists to mock the client in tests.
type WebhookClient interface {
	Do(req *http.Request) (*http.Response, error)
}

var netTransport = &http.Transport{
	TLSClientConfig: &tls.Config{
		Renegotiation: tls.RenegotiateFreelyAsClient,
	},
	Proxy: http.ProxyFromEnvironment,
	Dial: (&net.Dialer{
		Timeout: 30 * time.Second,
	}).Dial,
	TLSHandshakeTimeout: 5 * time.Second,
}
var netClient WebhookClient = &http.Client{
	Timeout:   time.Second * 30,
	Transport: netTransport,
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

	resp, err := netClient.Do(request)
	if err != nil {
		return err
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
			ns.log.Debug("Webhook failed validation", "url", webhook.Url, "statuscode", resp.Status, "body", string(body))
			return fmt.Errorf("webhook failed validation: %w", err)
		}
	}

	if resp.StatusCode/100 == 2 {
		ns.log.Debug("Webhook succeeded", "url", webhook.Url, "statuscode", resp.Status)
		return nil
	}

	ns.log.Debug("Webhook failed", "url", webhook.Url, "statuscode", resp.Status, "body", string(body))
	return fmt.Errorf("webhook response status %v", resp.Status)
}
