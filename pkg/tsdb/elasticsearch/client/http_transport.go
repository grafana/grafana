package es

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// httpTransport handles HTTP communication with Elasticsearch
type httpTransport struct {
	ctx        context.Context
	httpClient *http.Client
	baseURL    string
	logger     log.Logger
}

// newHTTPTransport creates a new HTTP transport
func newHTTPTransport(ctx context.Context, httpClient *http.Client, baseURL string, logger log.Logger) *httpTransport {
	return &httpTransport{
		ctx:        ctx,
		httpClient: httpClient,
		baseURL:    baseURL,
		logger:     logger,
	}
}

// executeBatchRequest executes a batch request to Elasticsearch
func (t *httpTransport) executeBatchRequest(uriPath, uriQuery string, body []byte) (*http.Response, error) {
	return t.executeRequest(http.MethodPost, uriPath, uriQuery, body)
}

// executeRequest executes an HTTP request to Elasticsearch
func (t *httpTransport) executeRequest(method, uriPath, uriQuery string, body []byte) (*http.Response, error) {
	t.logger.Debug("Sending request to Elasticsearch", "url", t.baseURL)
	u, err := url.Parse(t.baseURL)
	if err != nil {
		return nil, backend.DownstreamError(fmt.Errorf("URL could not be parsed: %w", err))
	}
	u.Path = path.Join(u.Path, uriPath)
	u.RawQuery = uriQuery

	var req *http.Request
	if method == http.MethodPost {
		req, err = http.NewRequestWithContext(t.ctx, http.MethodPost, u.String(), bytes.NewBuffer(body))
	} else {
		req, err = http.NewRequestWithContext(t.ctx, http.MethodGet, u.String(), nil)
	}
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-ndjson")

	//nolint:bodyclose
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}
