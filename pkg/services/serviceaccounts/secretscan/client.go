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
)

const timeout = 4 * time.Second
const maxTokensPerRequest = 100

// SecretScan Client is grafana's client for checking leaked keys.
// Don't use this client directly,
// use the secretscan Service which handles token collection and checking instead.
type client struct {
	httpClient *http.Client
	version    string
	baseURL    string
}

type secretscanRequest struct {
	KeyHashes []string `json:"hashes"`
}

type Token struct {
	Type       string `json:"type"`
	URL        string `json:"url"`
	Hash       string `json:"hash"`
	ReportedAt string `json:"reported_at"` //nolint
}

var (
	ErrInvalidStatusCode = errors.New("invalid status code")
	errSecretScanURL     = errors.New("secretscan url must be https")
)

func newClient(url, version string, dev bool) (*client, error) {
	if !strings.HasPrefix(url, "https://") && !dev {
		return nil, errSecretScanURL
	}

	return &client{
		version: version,
		baseURL: url,
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

// checkTokens checks if any leaked tokens exist.
// Returns list of leaked tokens.
func (c *client) CheckTokens(ctx context.Context, keyHashes []string) ([]Token, error) {
	// decode response body
	tokens := make([]Token, 0, len(keyHashes))

	// batch requests to secretscan server
	err := batch(len(keyHashes), maxTokensPerRequest, func(start, end int) error {
		bTokens, err := c.checkTokens(ctx, keyHashes[start:end])
		if err != nil {
			return err
		}

		tokens = append(tokens, bTokens...)
		return nil
	})

	if err != nil {
		return nil, err
	}

	return tokens, nil
}

func (c *client) checkTokens(ctx context.Context, keyHashes []string) ([]Token, error) {
	// create request body
	values := secretscanRequest{KeyHashes: keyHashes}

	jsonValue, err := json.Marshal(values)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", "failed to make http request", err)
	}

	// Build URL
	url := fmt.Sprintf("%s/tokens", c.baseURL)
	// Create request for secretscan server
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		url, bytes.NewReader(jsonValue))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", "failed to make http request", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "grafana-secretscan-client/"+c.version)

	// make http POST request to check for leaked tokens.
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", "failed to do http request", err)
	}

	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w. status code: %s", ErrInvalidStatusCode, resp.Status)
	}

	// decode response body
	var tokens []Token
	if err := json.NewDecoder(resp.Body).Decode(&tokens); err != nil {
		return nil, fmt.Errorf("%s: %w", "failed to decode response body", err)
	}

	return tokens, nil
}

func batch(count, size int, eachFn func(start, end int) error) error {
	for i := 0; i < count; {
		end := i + size
		if end > count {
			end = count
		}

		if err := eachFn(i, end); err != nil {
			return err
		}

		i = end
	}

	return nil
}
