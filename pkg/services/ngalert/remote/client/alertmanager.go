package client

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"

	httptransport "github.com/go-openapi/runtime/client"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/client"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	amclient "github.com/prometheus/alertmanager/api/v2/client"
)

const alertmanagerAPIMountPath = "/alertmanager"
const alertmanagerReadyPath = "/-/ready"

type AlertmanagerConfig struct {
	TenantID string
	Password string
	URL      *url.URL
	Logger   log.Logger
}

type Alertmanager struct {
	*amclient.AlertmanagerAPI
	httpClient client.Requester
	url        *url.URL
	logger     log.Logger
}

func NewAlertmanager(cfg *AlertmanagerConfig, metrics *metrics.RemoteAlertmanager, tracer tracing.Tracer) (*Alertmanager, error) {
	// First, add the authentication middleware.
	c := &http.Client{Transport: &MimirAuthRoundTripper{
		TenantID: cfg.TenantID,
		Password: cfg.Password,
		Next:     http.DefaultTransport,
	}}

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
		httpClient:      tc,
	}, nil
}

// GetAuthedClient returns a client.Requester that includes a configured MimirAuthRoundTripper.
// Requests using this client are fully authenticated.
func (am *Alertmanager) GetAuthedClient() client.Requester {
	return am.httpClient
}

// IsReadyWithBackoff executes a readiness check against the `/-/ready` Alertmanager endpoint.
// If it takes more than 10s to get a response back - we abort the check.
func (am *Alertmanager) IsReadyWithBackoff(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	readyURL := am.url.JoinPath(alertmanagerAPIMountPath, alertmanagerReadyPath)

	attempt := func() (int, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, readyURL.String(), nil)
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

	var attempts int
	ticker := time.NewTicker(100 * time.Millisecond)
	deadlineCh := time.After(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			attempts++
			status, err := attempt()
			if err != nil {
				am.logger.Debug("Ready check attempt failed", "attempt", attempts, "err", err)
				continue
			}

			if status != http.StatusOK {
				if status >= 400 && status < 500 {
					am.logger.Debug("Ready check failed with non-retriable status code", "attempt", attempts, "status", status)
					return false, fmt.Errorf("ready check failed with non-retriable status code %d", status)
				}
				am.logger.Debug("Ready check failed, status code is not 200", "attempt", attempts, "status", status, "err", err)
				continue
			}

			return true, nil
		case <-deadlineCh:
			cancel()
			return false, fmt.Errorf("ready check timed out after %d attempts", attempts)
		}
	}
}
