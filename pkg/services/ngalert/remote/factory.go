package remote

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

// NewFactory returns a function to override the default AM factory in the multi-org Alertmanager
// so that each org uses the remote Alertmanager.
func NewFactory(
	cfg AlertmanagerConfig,
	store kvstore.KVStore,
	crypto Crypto,
	m *metrics.RemoteAlertmanager,
	t tracing.Tracer,
	features featuremgmt.FeatureToggles,
) func(notifier.OrgAlertmanagerFactory) notifier.OrgAlertmanagerFactory {
	return func(notifier.OrgAlertmanagerFactory) notifier.OrgAlertmanagerFactory {
		return func(ctx context.Context, orgID int64) (notifier.Alertmanager, error) {
			cfg.OrgID = orgID
			cfg.PromoteConfig = true
			am, err := NewAlertmanager(ctx, cfg, notifier.NewFileStore(cfg.OrgID, store), crypto, m, t, features)
			if err != nil {
				return nil, fmt.Errorf("failed to create remote Alertmanager: %w", err)
			}
			return am, nil
		}
	}
}
