package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/remote/client"
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

// RemoteLimitsProvider fetches limits from a remote alertmanager via the MimirClient.
type RemoteLimitsProvider struct {
	client *client.Mimir
}

func NewRemoteLimitsProvider(c *client.Mimir) *RemoteLimitsProvider {
	return &RemoteLimitsProvider{
		client: c,
	}
}

func (p *RemoteLimitsProvider) GetLimits(ctx context.Context) (*client.TenantLimits, error) {
	return p.client.GetLimits(ctx)
}
