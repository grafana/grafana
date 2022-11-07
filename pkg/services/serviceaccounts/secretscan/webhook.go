package secretscan

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"github.com/pkg/errors"
)

// webHookClient is a client for sending leak notifications.
type webHookClient struct {
	httpClient *http.Client
	version    string
	url        string
}

var ErrInvalidWebHookStatusCode = errors.New("invalid webhook status code")

func newWebHookClient(url, version string) *webHookClient {
	return &webHookClient{
		version: version,
		url:     url,
		httpClient: &http.Client{
			Transport:     nil,
			CheckRedirect: nil,
			Jar:           nil,
			Timeout:       timeout,
		},
	}
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
		"image_url":                "https://images.pexels.com/photos/5119737/pexels-photo-5119737.jpeg?auto=compress&cs=tinysrgb&w=300", //nolint
		"state":                    "alerting",
		"link_to_upstream_details": token.URL,
		"message": "Token of type " +
			token.Type + " with name " +
			tokenName + " has been publicly exposed in " +
			token.URL + "." + revokedMsg,
	}

	jsonValue, err := json.Marshal(values)
	if err != nil {
		return errors.Wrap(err, "failed to marshal webhook request")
	}

	// Build URL
	// Create request for secretscan server
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		wClient.url, bytes.NewReader(jsonValue))
	if err != nil {
		return errors.Wrap(err, "failed to make http request")
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "grafana-secretscan-webhook-client/"+wClient.version)

	// make http POST request to check for leaked tokens.
	resp, err := wClient.httpClient.Do(req)
	if err != nil {
		return errors.Wrap(err, "failed to webhook request")
	}

	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w. status code %s", ErrInvalidWebHookStatusCode, resp.Status)
	}

	return nil
}
