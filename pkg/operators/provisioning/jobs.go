package provisioning

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/jobs"
	"github.com/grafana/grafana/apps/provisioning/pkg/jobs/workers"
	"github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

type driverConfig struct {
	concurrentDrivers int
	maxJobTimeout     time.Duration
	// jobInterval is the jobs informer's resync cadence; the driver uses it as
	// the post-claim cooldown so failed-run recovery tracks the configured
	// pickup interval.
	jobInterval          time.Duration
	leaseRenewalInterval time.Duration
	maxSyncWorkers       int
}

// buildDriver constructs the ConcurrentJobDriver with the shared job workers
// plus the operator's pull request worker.
func buildDriver(
	cfg *setting.Cfg,
	controllerCfg *ControllerConfig,
	registry prometheus.Registerer,
	tracer tracing.Tracer,
	dc driverConfig,
	jobStore jobs.Store,
	jobHistoryWriter jobs.HistoryWriter,
) (*jobs.ConcurrentJobDriver, error) {
	clients, err := controllerCfg.Clients()
	if err != nil {
		return nil, fmt.Errorf("failed to get clients: %w", err)
	}
	resourceLister, err := controllerCfg.ResourceLister()
	if err != nil {
		return nil, err
	}
	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning client: %w", err)
	}
	repoFactory, err := controllerCfg.RepositoryFactory()
	if err != nil {
		return nil, fmt.Errorf("failed to get repository factory: %w", err)
	}
	urlProvider, err := controllerCfg.URLProvider()
	if err != nil {
		return nil, fmt.Errorf("failed to get URL provider: %w", err)
	}

	parsers := resources.NewParserFactory(clients)
	metrics := jobs.RegisterJobMetrics(registry)
	jobWorkers := workers.New(workers.Config{
		Clients:             clients,
		RepositoryResources: resources.NewRepositoryResourcesFactory(parsers, clients, resourceLister),
		ResourceLister:      resourceLister,
		PatchStatus:         controller.NewRepositoryStatusPatcher(provisioningClient.ProvisioningV0alpha1()).Patch,
		Tracer:              tracer,
		Metrics:             metrics,
		MaxSyncWorkers:      dc.maxSyncWorkers,
		SyncResourceTimeout: cfg.ProvisioningSyncResourceTimeout,
		MaxFileSize:         cfg.ProvisioningMaxFileSize,
	})

	urls := pullrequest.URLProvider{Internal: urlProvider, Public: urlProvider}
	evaluator := pullrequest.NewEvaluator(pullrequest.NewNoOpRenderer(), parsers, urls, registry)
	commenter := pullrequest.NewCommenter(false, urls)
	jobWorkers = append(jobWorkers, pullrequest.NewPullRequestWorker(evaluator, commenter, registry))

	driver, err := jobs.NewConcurrentJobDriver(
		dc.concurrentDrivers,
		dc.maxJobTimeout,
		dc.jobInterval,
		dc.leaseRenewalInterval,
		jobStore,
		resources.NewRepositoryGetter(repoFactory, provisioningClient.ProvisioningV0alpha1()),
		jobHistoryWriter,
		registry,
		&metrics,
		nats.Enabled(controllerCfg.natsSubscriber),
		jobWorkers...,
	)
	if err != nil {
		return nil, err
	}
	driver.SetTracer(tracer)
	return driver, nil
}
