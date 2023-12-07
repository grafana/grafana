package client

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"

	httptransport "github.com/go-openapi/runtime/client"
	"github.com/grafana/grafana/pkg/infra/log"
	amclient "github.com/prometheus/alertmanager/api/v2/client"
)

type AlertmanagerClient interface {
	amclient.AlertmanagerAPI
}

const alertmanagerAPIMounthPath = "/alertmanager"
const alertmanagerReadyPath = "/-/ready"

type AlertmanagerConfig struct {
	TenantID string
	Password string
	URL      *url.URL
	Logger   log.Logger
}

type Alertmanager struct {
	*amclient.AlertmanagerAPI
	httpClient *http.Client
	url        *url.URL
	logger     log.Logger
}

func NewAlertmanager(cfg *AlertmanagerConfig) (*Alertmanager, error) {
	// First, add the authentication middleware.
	c := &http.Client{Transport: &MimirAuthRoundTripper{
		TenantID: cfg.TenantID,
		Password: cfg.Password,
		Next:     http.DefaultTransport,
	}}

	apiEndpoint := *cfg.URL

	// Next, make sure you set the right path.
	u := apiEndpoint.JoinPath(alertmanagerAPIMounthPath, amclient.DefaultBasePath)
	transport := httptransport.NewWithClient(u.Host, u.Path, []string{u.Scheme}, c)

	return &Alertmanager{
		logger:          cfg.Logger,
		url:             cfg.URL,
		AlertmanagerAPI: amclient.New(transport, nil),
		httpClient:      c,
	}, nil
}

// GetAuthedClient returns a *http.Client that includes a configured MimirAuthRoundTripper.
// Requests using this client are fully authenticated.
func (am *Alertmanager) GetAuthedClient() *http.Client {
	return am.httpClient
}

func (am *Alertmanager) IsReadyWithBackoff(ctx context.Context) (bool, error) {
	attempt := func() (int, error) {
		readyURL := am.url.JoinPath(am.url.Path, alertmanagerReadyPath)
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
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			attempts++
			status, err := attempt()
			if err != nil {
				am.logger.Error("Ready check attempt failed", "attempt", attempts, "err", err)
				continue
			}

			if status != http.StatusOK {
				am.logger.Error("Ready check failed, status code is not 200", "attempt", attempts, "status", status, "err", err)
				continue
			}

			return true, nil
		case <-time.After(10 * time.Second):
			return false, errors.New("ready check timed out")
		}
	}
}
