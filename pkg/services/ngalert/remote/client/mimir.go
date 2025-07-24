package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/client"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/util/httpclient"
)

// MimirClient contains all the methods to query the migration critical endpoints of Mimir instance, it's an interface to allow multiple implementations.
type MimirClient interface {
	GetFullState(ctx context.Context) (*UserState, error)
	GetGrafanaAlertmanagerState(ctx context.Context) (*UserState, error)
	CreateGrafanaAlertmanagerState(ctx context.Context, state string) error
	DeleteGrafanaAlertmanagerState(ctx context.Context) error

	GetGrafanaAlertmanagerConfig(ctx context.Context) (*UserGrafanaConfig, error)
	CreateGrafanaAlertmanagerConfig(ctx context.Context, configuration GrafanaAlertmanagerConfig, hash string, createdAt int64, isDefault bool) error
	DeleteGrafanaAlertmanagerConfig(ctx context.Context) error

	TestTemplate(ctx context.Context, c alertingNotify.TestTemplatesConfigBodyParams) (*alertingNotify.TestTemplatesResults, error)
	TestReceivers(ctx context.Context, c alertingNotify.TestReceiversConfigBodyParams) (*alertingNotify.TestReceiversResult, int, error)

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
	externalURL   string
	smtpConfig    SmtpConfig

	// TODO: Remove once everything can be sent in the 'smtp' field.
	smtpFrom      string
	staticHeaders map[string]string
}

type SmtpConfig struct {
	EhloIdentity   string            `json:"ehlo_identity"`
	FromAddress    string            `json:"from_address"`
	FromName       string            `json:"from_name"`
	Host           string            `json:"host"`
	Password       string            `json:"password"`
	SkipVerify     bool              `json:"skip_verify"`
	StartTLSPolicy string            `json:"start_tls_policy"`
	StaticHeaders  map[string]string `json:"static_headers"`
	User           string            `json:"user"`
}

type Config struct {
	URL      *url.URL
	TenantID string
	Password string

	Logger        log.Logger
	PromoteConfig bool
	ExternalURL   string
	Smtp          SmtpConfig

	// TODO: Remove once everything can be sent in the 'smtp_config' field.
	SmtpFrom      string
	StaticHeaders map[string]string
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
		Next:     httpclient.NewHTTPTransport(),
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
		externalURL:   cfg.ExternalURL,
		smtpConfig:    cfg.Smtp,

		// TODO: Remove once everything can be sent in the 'smtp_config' field.
		smtpFrom:      cfg.SmtpFrom,
		staticHeaders: cfg.StaticHeaders,
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
		body, err := io.ReadAll(resp.Body)
		bodyStr := string(body)
		if err != nil {
			bodyStr = fmt.Sprintf("fail_to_read: %s", err)
		}
		mc.logger.Error(msg, "content-type", "url", r.URL.String(), "method", r.Method, ct, "status", resp.StatusCode, "body", bodyStr)
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

func (mc *Mimir) TestReceivers(ctx context.Context, c alertingNotify.TestReceiversConfigBodyParams) (*alertingNotify.TestReceiversResult, int, error) {
	payload, err := json.Marshal(c)
	if err != nil {
		return nil, 0, err
	}

	trResult := &alertingNotify.TestReceiversResult{}

	// nolint:bodyclose
	// closed within `do`
	_, err = mc.do(ctx, "api/v1/grafana/receivers/test", http.MethodPost, bytes.NewBuffer(payload), &trResult)
	if err != nil {
		return nil, 0, err
	}

	return trResult, http.StatusOK, nil
}

func (mc *Mimir) TestTemplate(ctx context.Context, c alertingNotify.TestTemplatesConfigBodyParams) (*alertingNotify.TestTemplatesResults, error) {
	payload, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}

	ttResult := &alertingNotify.TestTemplatesResults{}

	// nolint:bodyclose
	// closed within `do`
	_, err = mc.do(ctx, "api/v1/grafana/templates/test", http.MethodPost, bytes.NewBuffer(payload), &ttResult)
	if err != nil {
		return nil, err
	}

	return ttResult, nil
}
