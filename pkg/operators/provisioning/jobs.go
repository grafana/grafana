package provisioning

import (
	"context"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/jobqueue"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// buildDriver resolves the job queue dependencies from the operator config and
// hands them to jobqueue.ProvideDriver, which the API server uses as well.
func buildDriver(
	controllerCfg *jobQueueControllerConfig,
	registry prometheus.Registerer,
	jobStore jobs.Store,
	jobHistoryWriter jobs.HistoryWriter,
) (*jobs.ConcurrentJobDriver, error) {
	tracer, err := controllerCfg.Tracer()
	if err != nil {
		return nil, fmt.Errorf("failed to provide tracing service: %w", err)
	}

	clients, err := controllerCfg.Clients()
	if err != nil {
		return nil, fmt.Errorf("failed to get clients: %w", err)
	}
	parsers := resources.NewParserFactory(clients)

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

	prWorker, err := buildPullRequestWorker(&controllerCfg.ControllerConfig, parsers, registry)
	if err != nil {
		return nil, err
	}

	return jobqueue.ProvideDriver(
		jobqueue.Config{
			ConcurrentDrivers:    controllerCfg.concurrentDrivers,
			MaxJobTimeout:        controllerCfg.maxJobTimeout,
			JobInterval:          controllerCfg.jobInterval,
			LeaseRenewalInterval: controllerCfg.leaseRenewalInterval,
			MaxSyncWorkers:       controllerCfg.maxSyncWorkers,
			MaxFileSize:          controllerCfg.Settings.ProvisioningMaxFileSize,
			SyncResourceTimeout:  controllerCfg.Settings.ProvisioningSyncResourceTimeout,
		},
		jobqueue.Dependencies{
			Clients:             clients,
			RepositoryResources: resources.NewRepositoryResourcesFactory(parsers, clients, resourceLister),
			ResourceLister:      resourceLister,
			PatchStatus:         controller.NewRepositoryStatusPatcher(provisioningClient.ProvisioningV0alpha1()).Patch,
			Store:               jobStore,
			RepoGetter:          resources.NewRepositoryGetter(repoFactory, provisioningClient.ProvisioningV0alpha1()),
			HistoryWriter:       jobHistoryWriter,
			Tracer:              tracer,
			Registry:            registry,
			PerformanceEnabled:  performanceEnabled,
			NATSBacked:          nats.Enabled(controllerCfg.natsSubscriber),
			ExtraWorkers:        []jobs.Worker{prWorker},
		},
	)
}

func buildPullRequestWorker(controllerCfg *ControllerConfig, parsers resources.ParserFactory, registry prometheus.Registerer) (jobs.Worker, error) {
	urlProvider, err := controllerCfg.URLProvider()
	if err != nil {
		return nil, fmt.Errorf("failed to get URL provider: %w", err)
	}

	urls := pullrequest.URLProvider{Internal: urlProvider, Public: urlProvider}
	evaluator := pullrequest.NewEvaluator(pullrequest.NewNoOpRenderer(), parsers, urls, registry)
	commenter := pullrequest.NewCommenter(false, urls)
	return pullrequest.NewPullRequestWorker(evaluator, commenter, registry), nil
}

// performanceEnabled is evaluated per job via OpenFeature so the flag behaves
// consistently with the API server.
func performanceEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagProvisioningPerformance, false, openfeature.TransactionContext(ctx))
}
