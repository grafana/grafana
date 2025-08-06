package client

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"

	httptransport "github.com/go-openapi/runtime/client"
	"github.com/grafana/alerting/client"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/util/httpclient"
	amclient "github.com/prometheus/alertmanager/api/v2/client"
)

const alertmanagerAPIMountPath = "/alertmanager"
const alertmanagerReadyPath = "/-/ready"

type AlertmanagerConfig struct {
	TenantID string
	Password string
	URL      *url.URL
	Logger   log.Logger
	Timeout  time.Duration
}

type Alertmanager struct {
	*amclient.AlertmanagerAPI
	httpClient client.Requester
	url        *url.URL
	logger     log.Logger
}

func NewAlertmanager(cfg *AlertmanagerConfig, metrics *metrics.RemoteAlertmanager, tracer tracing.Tracer) (*Alertmanager, error) {
	// First, set up the http client.
	c := &http.Client{
		Transport: &MimirAuthRoundTripper{
			TenantID: cfg.TenantID,
			Password: cfg.Password,
			Next:     httpclient.NewHTTPTransport(),
		},
		Timeout: cfg.Timeout,
	}

	tc := client.NewTimedClient(c, metrics.RequestLatency)
	trc := client.NewTracedClient(tc, tracer, "remote.alertmanager.client")
	apiEndpoint := *cfg.URL

	// Next, make sure you set the right path.
	u := apiEndpoint.JoinPath(alertmanagerAPIMountPath, amclient.DefaultBasePath)

	// Create an Alertmanager client using the instrumented client as the transport.
	r := httptransport.New(u.Host, u.Path, []string{u.Scheme})
	r.Transport = trc

	return &Alertmanager{
		logger:          cfg.Logger,
		url:             cfg.URL,
		AlertmanagerAPI: amclient.New(r, nil),
		httpClient:      trc,
	}, nil
}

// GetAuthedClient returns a client.Requester that includes a configured MimirAuthRoundTripper.
// Requests using this client are fully authenticated.
func (am *Alertmanager) GetAuthedClient() client.Requester {
	return am.httpClient
}

// IsReadyWithBackoff executes a readiness check against the `/-/ready` Alertmanager endpoint.
// It uses exponential backoff (100ms * 2^attempts) with a 10s timeout.
func (am *Alertmanager) IsReadyWithBackoff(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var wait time.Duration
	for attempt := 1; ; attempt++ {
		select {
		case <-ctx.Done():
			return fmt.Errorf("readiness check timed out")
		case <-time.After(wait):
			wait = time.Duration(100<<attempt-1) * time.Millisecond
			status, err := am.checkReadiness(ctx)
			if err != nil {
				am.logger.Debug("Readiness check attempt failed", "attempt", attempt, "err", err)
				break
			}

			if status == http.StatusOK {
				return nil
			}

			if status == http.StatusNotAcceptable {
				// Mimir returns a 406 when the Alertmanager for the tenant is not running.
				// This is expected if the Grafana Alertmanager configuration is default or not promoted.
				// We can still use the endpoints to store and retrieve configuration/state.
				am.logger.Debug("Remote Alertmanager not initialized for tenant")
				return nil
			}

			if status >= 400 && status < 500 {
				return fmt.Errorf("readiness check failed on attempt %d with non-retriable status code %d", attempt, status)
			}
			am.logger.Debug("Readiness check failed, status code is not 200", "attempt", attempt, "status", status, "err", err)
		}
	}
}

func (am *Alertmanager) checkReadiness(ctx context.Context) (int, error) {
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		am.url.JoinPath(alertmanagerAPIMountPath, alertmanagerReadyPath).String(),
		nil,
	)
	if err != nil {
		return 0, fmt.Errorf("error creating the readiness request: %w", err)
	}

	res, err := am.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("error performing the readiness check: %w", err)
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			am.logger.Warn("Error closing response body", "err", err)
		}
	}()

	return res.StatusCode, nil
}
