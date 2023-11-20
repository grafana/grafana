package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Client contains all the methods to query the migration critical endpoints of Mimir instance, it's an interface to allow multiple implementations.
type Client interface {
	GetGrafanaAlertmanagerConfiguration()
	SetGrafanaAlertmanagerConfiguration()
	DeleteGrafanaAlertmanagerConfiguration()

	GetGrafanaAlertmanagerState()
	SetGrafanaAlertmanagerState()
	DeleteGrafanaAlertmanagerState()
}

type Mimir struct {
	endpoint *url.URL
	client   http.Client
	logger   log.Logger
}

type Config struct {
	Address  string
	TenantID string
	Password string

	Logger log.Logger
}

// successResponse represents a successful response from the Mimir API.
type successResponse struct {
	Status string `json:"status"`
	Data   any    `json:"data"`
}

// errorResponse represents an error from the Mimir API.
type errorResponse struct {
	Status string `json:"status"`
	Error1 string `json:"error"`
	Error2 string `json:"Error"`
}

func (e *errorResponse) Error() string {
	if e.Error1 != "" {
		return e.Error1
	}

	return e.Error2
}

func New(cfg *Config) (*Mimir, error) {
	endpoint, err := url.Parse(cfg.Address)
	if err != nil {
		return nil, err
	}

	rt := &MimirAuthRoundTripper{
		TenantID: cfg.TenantID,
		Password: cfg.Password,
		Next:     http.DefaultTransport,
	}

	c := http.Client{
		Transport: rt,
	}

	return &Mimir{
		endpoint: endpoint,
		client:   c,
		logger:   cfg.Logger,
	}, nil
}

// do execute an HTTP requests against the specified path and method using the specified payload. It returns the HTTP response.
func (mc *Mimir) do(ctx context.Context, p, method string, payload io.Reader, contentLength int64, out any) (*http.Response, error) {
	pathURL, err := url.Parse(p)
	if err != nil {
		return nil, err
	}

	endpoint := *mc.endpoint
	endpoint.Path = path.Join(endpoint.Path, pathURL.Path)

	r, err := http.NewRequestWithContext(ctx, method, endpoint.String(), payload)
	if err != nil {
		return nil, err
	}

	r.Header.Set("Accept", "application/json")
	r.Header.Set("Content-Type", "application/json")

	if contentLength > 0 {
		r.ContentLength = contentLength
	}

	logger := mc.logger.New("url", r.URL.String(), "method", r.Method)
	resp, err := mc.client.Do(r)
	if err != nil {
		msg := "unable to fulfill request to the Mimir API"
		logger.Error(msg, "err", err)
		return nil, fmt.Errorf("%s: %w", msg, err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("error closing HTTP body", "err", err)
		}
	}()

	logger = logger.New("status", resp.StatusCode)
	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		msg := "response content-type is not application/json"
		logger.Error(msg, "err", err)
		return nil, fmt.Errorf("%s: %w", msg, err)
	}

	if out == nil {
		return resp, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		msg := "failed to read the request body"
		logger.Error(msg, "err", err)
		return nil, fmt.Errorf("%s: %w", msg, err)
	}

	if resp.StatusCode/100 != 2 {
		errResponse := &errorResponse{}
		jsonErr := json.Unmarshal(body, errResponse)

		if jsonErr == nil && errResponse.Error() != "" {
			msg := "error response from the Mimir API"
			logger.Error(msg, "err", errResponse)
			return nil, fmt.Errorf("%s: %w", msg, &errResponse)
		}

		msg := "failed to decode non-2xx JSON response"
		logger.Error(msg, "err", jsonErr)
		return nil, fmt.Errorf("%s: %w", msg, jsonErr)
	}

	if err = json.Unmarshal(body, &out); err != nil {
		msg := "failed to decode 2xx JSON response"
		logger.Error(msg, "err", err)
		return nil, fmt.Errorf("%s: %w", msg, err)
	}

	return resp, nil
}

func (mc *Mimir) doOK(ctx context.Context, p, method string, payload io.Reader, contentLength int64) error {
	var sr successResponse
	resp, err := mc.do(ctx, p, method, payload, contentLength, sr)
	if err != nil {
		return err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			mc.logger.Error("error closing HTTP body", "err", err)
		}
	}()

	switch sr.Status {
	case "success":
		return nil
	case "error":
		return errors.New("received an 2xx status code but the request body reflected an error")
	default:
		return fmt.Errorf("received an unknown status from the request body: %s", sr.Status)
	}
}
