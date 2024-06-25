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
	"github.com/grafana/grafana/pkg/infra/tracing"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/client"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
)

// MimirClient contains all the methods to query the migration critical endpoints of Mimir instance, it's an interface to allow multiple implementations.
type MimirClient interface {
	GetGrafanaAlertmanagerState(ctx context.Context) (*UserGrafanaState, error)
	CreateGrafanaAlertmanagerState(ctx context.Context, state string) error
	DeleteGrafanaAlertmanagerState(ctx context.Context) error

	GetGrafanaAlertmanagerConfig(ctx context.Context) (*UserGrafanaConfig, error)
	CreateGrafanaAlertmanagerConfig(ctx context.Context, configuration *apimodels.PostableUserConfig, hash string, createdAt int64, isDefault bool) error
	DeleteGrafanaAlertmanagerConfig(ctx context.Context) error

	ShouldPromoteConfig() bool

	// Mimir implements an extended version of the receivers API under a different path.
	GetReceivers(ctx context.Context) ([]apimodels.Receiver, error)
}

type Mimir struct {
	client        client.Requester
	endpoint      *url.URL
	logger        log.Logger
	metrics       *metrics.RemoteAlertmanager
	promoteConfig bool
}

type Config struct {
	URL      *url.URL
	TenantID string
	Password string

	Logger        log.Logger
	PromoteConfig bool
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

func New(cfg *Config, metrics *metrics.RemoteAlertmanager, tracer tracing.Tracer) (*Mimir, error) {
	rt := &MimirAuthRoundTripper{
		TenantID: cfg.TenantID,
		Password: cfg.Password,
		Next:     http.DefaultTransport,
	}

	c := &http.Client{
		Transport: rt,
	}
	tc := client.NewTimedClient(c, metrics.RequestLatency)
	trc := client.NewTracedClient(tc, tracer, "remote.alertmanager.client")

	return &Mimir{
		endpoint:      cfg.URL,
		client:        trc,
		logger:        cfg.Logger,
		metrics:       metrics,
		promoteConfig: cfg.PromoteConfig,
	}, nil
}

// do execute an HTTP requests against the specified path and method using the specified payload.
// It returns the HTTP response.
func (mc *Mimir) do(ctx context.Context, p, method string, payload io.Reader, out any) (*http.Response, error) {
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

	resp, err := mc.client.Do(r)
	if err != nil {
		msg := "Unable to fulfill request to the Mimir API"
		mc.logger.Error(msg, "err", err, "url", r.URL.String(), "method", r.Method)
		return nil, fmt.Errorf("%s: %w", msg, err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			mc.logger.Error("Error closing HTTP body", "err", err, "url", r.URL.String(), "method", r.Method)
		}
	}()

	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		msg := "Response content-type is not application/json"
		mc.logger.Error(msg, "content-type", "url", r.URL.String(), "method", r.Method, ct, "status", resp.StatusCode)
		return nil, fmt.Errorf("%s: %s", msg, ct)
	}

	if out == nil {
		return resp, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		msg := "Failed to read the request body"
		mc.logger.Error(msg, "err", err, "url", r.URL.String(), "method", r.Method, "status", resp.StatusCode)
		return nil, fmt.Errorf("%s: %w", msg, err)
	}

	if resp.StatusCode/100 != 2 {
		errResponse := &errorResponse{}
		err = json.Unmarshal(body, errResponse)

		if err == nil && errResponse.Error() != "" {
			msg := "Error response from the Mimir API"
			mc.logger.Error(msg, "err", errResponse, "url", r.URL.String(), "method", r.Method, "status", resp.StatusCode)
			return nil, fmt.Errorf("%s: %w", msg, errResponse)
		}

		msg := "Failed to decode non-2xx JSON response"
		mc.logger.Error(msg, "err", err, "url", r.URL.String(), "method", r.Method, "status", resp.StatusCode)
		return nil, fmt.Errorf("%s: %w", msg, err)
	}

	if err = json.Unmarshal(body, out); err != nil {
		msg := "Failed to decode 2xx JSON response"
		mc.logger.Error(msg, "err", err, "url", r.URL.String(), "method", r.Method, "status", resp.StatusCode)
		return nil, fmt.Errorf("%s: %w", msg, err)
	}

	return resp, nil
}

func (mc *Mimir) doOK(ctx context.Context, p, method string, payload io.Reader) error {
	var sr successResponse
	resp, err := mc.do(ctx, p, method, payload, &sr)
	if err != nil {
		return err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			mc.logger.Error("Error closing HTTP body", "err", err)
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
