package provisioning

import (
	"context"
	"fmt"
	"time"

	clientrest "k8s.io/client-go/rest"

	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/setting"
)

// HistoryJobCleanupServiceName is the background-service module name of
// [HistoryJobCleanupService].
const HistoryJobCleanupServiceName = "provisioning-history-job-cleanup"

var _ registry.CanBeDisabled = (*HistoryJobCleanupService)(nil)

// HistoryJobCleanupService deletes expired HistoricJobs in the Grafana process
// once the provisioning API is served, until shutdown.
type HistoryJobCleanupService struct {
	*loopbackService

	subscriber nats.Subscriber
	expiration time.Duration
}

// ProvideHistoryJobCleanupService is called by Wire. Depending on the builder
// orders it after [RegisterAPIService], which registers the provisioning API
// group with the API server.
func ProvideHistoryJobCleanupService(cfg *setting.Cfg, builder *APIBuilder, subscriber nats.Subscriber) *HistoryJobCleanupService {
	expiration := cfg.ProvisioningHistoryExpiration
	if expiration <= 0 {
		expiration = setting.ProvisioningHistoryExpirationDefault
	}
	s := &HistoryJobCleanupService{subscriber: subscriber, expiration: expiration}
	s.loopbackService = newLoopbackService(HistoryJobCleanupServiceName, builder, s.runController)
	return s
}

// IsDisabled implements registry.CanBeDisabled. Loki-backed history stores no
// HistoricJobs, so there is nothing to clean.
func (s *HistoryJobCleanupService) IsDisabled() bool {
	return s.loopbackService.IsDisabled() || (s.builder.jobHistoryConfig != nil && s.builder.jobHistoryConfig.Loki != nil)
}

func (s *HistoryJobCleanupService) runController(ctx context.Context, restConfig *clientrest.Config) error {
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("create provisioning clientset: %w", err)
	}

	source, err := controller.ProvideHistoryJobCleanup(ctx, nats.Enabled(s.subscriber), client, s.expiration)
	if err != nil {
		return err
	}
	source.Run(ctx.Done())
	return nil
}
