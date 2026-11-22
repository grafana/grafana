package provisioning

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/setting"
)

var _ registry.CanBeDisabled = (*HistoryJobCleanupService)(nil)

// HistoryJobCleanupService periodically deletes expired HistoricJobs. It depends
// on the provisioning API server: Run blocks until the builder's post-start hook
// has built the provisioning clientset, then runs the cleanup until shutdown.
type HistoryJobCleanupService struct {
	builder *APIBuilder
}

func ProvideHistoryJobCleanupService(builder *APIBuilder) *HistoryJobCleanupService {
	return &HistoryJobCleanupService{builder: builder}
}

// IsDisabled reports whether there is nothing for this instance to clean: the
// builder is nil when provisioning is disabled, controllers are off when running
// solely as an API server, and Loki-backed history stores no HistoricJobs.
func (s *HistoryJobCleanupService) IsDisabled() bool {
	b := s.builder
	return b == nil || b.onlyApiServer || (b.jobHistoryConfig != nil && b.jobHistoryConfig.Loki != nil)
}

func (s *HistoryJobCleanupService) Run(ctx context.Context) error {
	clientset, err := s.builder.waitForClientset(ctx)
	if err != nil {
		// Shut down before the API server became ready.
		return nil
	}

	expiration := s.builder.historyExpiration
	if expiration <= 0 {
		expiration = setting.ProvisioningHistoryExpirationDefault
	}
	source, err := controller.ProvideHistoryJobCleanup(nats.Enabled(s.builder.natsSubscriber), clientset, expiration)
	if err != nil {
		return err
	}
	logging.DefaultLogger.Info("starting historic job cleanup", "expiration", expiration.String())
	source.Run(ctx.Done())
	return nil
}
