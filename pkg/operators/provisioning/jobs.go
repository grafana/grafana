package provisioning

import (
	"context"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/jobqueue"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// buildJobQueue resolves the job queue dependencies from the operator config and
// hands them to jobqueue.ProvideJobQueue, which the API server uses as well.
func buildJobQueue(
	r *jobQueueRunner,
	registry prometheus.Registerer,
	jobStore jobs.Store,
	jobHistoryWriter jobs.HistoryWriter,
) (*jobqueue.Queue, error) {
	tracer := r.Tracer

	clients, err := r.ResourceClients()
	if err != nil {
		return nil, fmt.Errorf("failed to get clients: %w", err)
	}
	parsers := resources.NewParserFactory(clients)

	resourceLister, err := r.ResourceLister()
	if err != nil {
		return nil, err
	}

	provisioningClient, err := r.ProvisioningClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning client: %w", err)
	}

	repoFactory, err := r.RepositoryFactory()
	if err != nil {
		return nil, fmt.Errorf("failed to get repository factory: %w", err)
	}

	urlProvider, err := r.URLProvider()
	if err != nil {
		return nil, fmt.Errorf("failed to get URL provider: %w", err)
	}

	return jobqueue.ProvideJobQueue(
		jobqueue.Config{
			ConcurrentDrivers:    r.concurrentDrivers,
			MaxJobTimeout:        r.maxJobTimeout,
			JobInterval:          r.jobInterval,
			LeaseRenewalInterval: r.leaseRenewalInterval,
			MaxSyncWorkers:       r.maxSyncWorkers,
			MaxFileSize:          r.Cfg.ProvisioningMaxFileSize,
			SyncResourceTimeout:  r.Cfg.ProvisioningSyncResourceTimeout,
		},
		jobqueue.Dependencies{
			Client:              provisioningClient,
			Subscriber:          r.Subscriber,
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
			// The operator has no rendering service, so pull request comments carry no screenshots.
			ScreenshotRenderer: pullrequest.NewNoOpRenderer(),
			PullRequestURLs:    pullrequest.URLProvider{Internal: urlProvider, Public: urlProvider},
		},
	)
}

// performanceEnabled is evaluated per job via OpenFeature so the flag behaves
// consistently with the API server.
func performanceEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagProvisioningPerformance, false, openfeature.TransactionContext(ctx))
}
