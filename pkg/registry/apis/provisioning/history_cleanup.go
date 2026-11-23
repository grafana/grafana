package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/setting"
)

var _ registry.CanBeDisabled = (*HistoryJobCleanupService)(nil)

// HistoryJobCleanupService periodically deletes expired HistoricJobs. Run blocks
// until the Grafana API server is running, then runs the cleanup until shutdown.
type HistoryJobCleanupService struct {
	builder            *APIBuilder
	configProvider     apiserver.RestConfigProvider
	disableControllers bool
}

func ProvideHistoryJobCleanupService(cfg *setting.Cfg, builder *APIBuilder, configProvider apiserver.RestConfigProvider) *HistoryJobCleanupService {
	return &HistoryJobCleanupService{
		builder:            builder,
		configProvider:     configProvider,
		disableControllers: cfg.DisableControllers,
	}
}

// IsDisabled reports whether there is nothing for this instance to clean: the
// builder is nil when provisioning is disabled, controllers can be turned off by
// configuration, and Loki-backed history stores no HistoricJobs.
func (s *HistoryJobCleanupService) IsDisabled() bool {
	b := s.builder
	return b == nil || s.disableControllers || (b.jobHistoryConfig != nil && b.jobHistoryConfig.Loki != nil)
}

func (s *HistoryJobCleanupService) Run(ctx context.Context) error {
	restConfig, err := s.configProvider.GetRestConfig(ctx)
	if ctx.Err() != nil {
		// Shut down before the API server became ready.
		return nil
	}
	if err != nil {
		return fmt.Errorf("get rest config: %w", err)
	}
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("create provisioning clientset: %w", err)
	}

	expiration := s.builder.historyExpiration
	if expiration <= 0 {
		expiration = setting.ProvisioningHistoryExpirationDefault
	}
	source, err := controller.ProvideHistoryJobCleanup(ctx, s.builder.informers, client, expiration)
	if err != nil {
		return err
	}
	logging.DefaultLogger.Info("starting historic job cleanup", "expiration", expiration.String())
	source.Run(ctx.Done())
	return nil
}
