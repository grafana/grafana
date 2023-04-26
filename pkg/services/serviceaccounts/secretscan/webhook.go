package secretscan

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

var errWebHookURL = errors.New("webhook url must be https")

// webHookClient is a client for sending leak notifications.
type webHookClient struct {
	httpClient *http.Client
	version    string
	url        string
}

var ErrInvalidWebHookStatusCode = errors.New("invalid webhook status code")

func newWebHookClient(url, version string, dev bool) (*webHookClient, error) {
	if !strings.HasPrefix(url, "https://") && !dev {
		return nil, errWebHookURL
	}

	return &webHookClient{
		version: version,
		url:     url,
		httpClient: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					Renegotiation: tls.RenegotiateFreelyAsClient,
				},
				Proxy: http.ProxyFromEnvironment,
				DialContext: (&net.Dialer{
					Timeout:   timeout,
					KeepAlive: 15 * time.Second,
				}).DialContext,
				TLSHandshakeTimeout:   10 * time.Second,
				ExpectContinueTimeout: 1 * time.Second,
				MaxIdleConns:          100,
				IdleConnTimeout:       30 * time.Second,
			},
			Timeout: time.Second * 30,
		},
	}, nil
}

func (wClient *webHookClient) Notify(ctx context.Context,
	token *Token, tokenName string, revoked bool,
) error {
	revokedMsg := ""
	if revoked {
		revokedMsg = " Grafana has revoked this token"
	}

	// create request body
	values := map[string]interface{}{
		"alert_uid":                uuid.NewString(),
		"title":                    "SecretScan Alert: Grafana Token leaked",
		"state":                    "alerting",
		"link_to_upstream_details": token.URL,
		"message": "Token of type " +
			token.Type + " with name " +
			tokenName + " has been publicly exposed in " +
			token.URL + "." + revokedMsg,
	}

	jsonValue, err := json.Marshal(values)
	if err != nil {
		return fmt.Errorf("%s: %w", "failed to marshal webhook request", err)
	}

	// Build URL
	// Create request for secretscan server
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		wClient.url, bytes.NewReader(jsonValue))
	if err != nil {
		return fmt.Errorf("%s: %w", "failed to make http request", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "grafana-secretscan-webhook-client/"+wClient.version)

	// make http POST request to check for leaked tokens.
	resp, err := wClient.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%s: %w", "failed to webhook request", err)
	}

	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w. status code %s", ErrInvalidWebHookStatusCode, resp.Status)
	}

	return nil
}
