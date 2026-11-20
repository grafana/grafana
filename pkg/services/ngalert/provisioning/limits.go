package provisioning

import (
	"context"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/grafana/grafana/pkg/setting"
)

// LimitsProvider provides access to alertmanager limits for validation.
// Used for both template and silence limit validation.
// Different implementations are used for local vs remote alertmanager modes.
type LimitsProvider interface {
	// GetLimits retrieves the current limits. Returns nil limits (not an error) if limits are not configured.
	GetLimits(ctx context.Context) (*client.TenantLimits, error)
}

// NoopLimitsProvider is a LimitsProvider that always returns nil limits.
// Used when limits validation should be skipped (e.g., local alertmanager mode
// where limits are enforced at runtime by the alerting library).
type NoopLimitsProvider struct{}

func (p *NoopLimitsProvider) GetLimits(_ context.Context) (*client.TenantLimits, error) {
	return nil, nil
}

// limitsFetchTimeout bounds a limits lookup so a slow remote Alertmanager cannot stall config writes.
const limitsFetchTimeout = 5 * time.Second

// RemoteLimitsProvider fetches limits from a remote alertmanager via the MimirClient.
type RemoteLimitsProvider struct {
	client  *client.Mimir
	timeout time.Duration
}

func NewRemoteLimitsProvider(c *client.Mimir) *RemoteLimitsProvider {
	return &RemoteLimitsProvider{
		client:  c,
		timeout: limitsFetchTimeout,
	}
}

func (p *RemoteLimitsProvider) GetLimits(ctx context.Context) (*client.TenantLimits, error) {
	ctx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()
	return p.client.GetLimits(ctx)
}

// NewLimitsProvider returns a RemoteLimitsProvider when the remote Alertmanager is enabled
// and its client can be built, and a NoopLimitsProvider otherwise.
func NewLimitsProvider(cfg setting.RemoteAlertmanagerSettings, remoteEnabled bool, m *metrics.RemoteAlertmanager, tracer tracing.Tracer, logger log.Logger) LimitsProvider {
	if !remoteEnabled {
		// The local Alertmanager enforces limits at runtime in the alerting library.
		return &NoopLimitsProvider{}
	}

	remoteURL, err := url.Parse(cfg.URL)
	if err != nil {
		logger.Warn("Failed to parse remote alertmanager URL for limits provider, using noop limits", "error", err)
		return &NoopLimitsProvider{}
	}

	mimirClient, err := client.New(&client.Config{
		URL:      remoteURL,
		TenantID: cfg.TenantID,
		Password: cfg.Password,
		Logger:   log.New("ngalert.remote.limits"),
		Timeout:  cfg.Timeout,
	}, m, tracer)
	if err != nil {
		logger.Warn("Failed to create MimirClient for limits provider, using noop limits", "error", err)
		return &NoopLimitsProvider{}
	}
	return NewRemoteLimitsProvider(mimirClient)
}
