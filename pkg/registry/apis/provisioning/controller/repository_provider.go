package controller

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

// RepositoryControllerDeps is everything needed to build a RepositoryController
// and the repository delta source that feeds it. It is shared by the
// standalone operator and the in-process apiserver so both wire the
// controller identically.
type RepositoryControllerDeps struct {
	ProvisioningClient versioned.Interface
	// NATSSubscriber selects the NATS-backed informer when enabled; nil falls
	// back to the apiserver watch informer.
	NATSSubscriber nats.Subscriber
	// KeysLister makes the periodic re-list keys-only; nil re-lists full objects.
	KeysLister keysapi.Lister
	// The relist, freshness and health metrics are registered once per process
	// and shared with the other provisioning controllers.
	RelistProjectionMetrics *informer.RelistProjectionMetrics
	FreshnessMetrics        *informer.FreshnessMetrics
	HealthMetrics           HealthMetricsRecorder

	RepoFactory       repository.Factory
	ConnectionFactory connection.Factory
	ResourceLister    resources.ResourceLister
	Clients           resources.ClientFactory
	// Validator is the health checker's validation. Repositories already passed
	// admission, so callers pass basic validation only.
	Validator         repository.Validator
	QuotaGetter       quotas.QuotaGetter
	IncrementalPolicy repository.IncrementalSyncPolicy
	Registry          prometheus.Registerer
	Tracer            tracing.Tracer

	ParallelOperations            int
	ResyncInterval                time.Duration
	MinSyncInterval               time.Duration
	DrainTimeout                  time.Duration
	WebhookSecretRotationInterval time.Duration
}

// RepositoryControllerRunner is a repository controller wired to its delta source.
type RepositoryControllerRunner struct {
	source       informer.DeltaSource
	registration cache.ResourceEventHandlerRegistration
	controller   *RepositoryController
}

// ProvideRepositoryController builds the repository controller shared by the
// provisioning API server and the standalone repository operator: a
// RepositoryController, with its job store, status patcher and health checker,
// registered on the repository DeltaSource selected by deps.NATSSubscriber.
func ProvideRepositoryController(deps RepositoryControllerDeps) (*RepositoryControllerRunner, error) {
	provisioningClient := deps.ProvisioningClient.ProvisioningV0alpha1()
	jobStore, err := jobs.NewJobStore(provisioningClient, jobs.ClaimExpiry, deps.Registry)
	if err != nil {
		return nil, fmt.Errorf("create API client job store: %w", err)
	}
	statusPatcher := appcontroller.NewRepositoryStatusPatcher(provisioningClient)
	var validators []repository.Validator
	if deps.Validator != nil {
		validators = append(validators, deps.Validator)
	}
	healthChecker := NewRepositoryHealthChecker(statusPatcher, repository.NewTester(validators...), deps.HealthMetrics)

	source, repoGetter := informer.NewRepositoryDeltaSource(
		deps.NATSSubscriber,
		deps.ProvisioningClient,
		deps.KeysLister,
		deps.ResyncInterval,
		deps.RelistProjectionMetrics,
		deps.FreshnessMetrics,
	)

	rc := NewRepositoryController(
		provisioningClient,
		repoGetter,
		deps.RepoFactory,
		deps.ConnectionFactory,
		deps.ResourceLister,
		deps.Clients,
		jobStore,
		healthChecker,
		statusPatcher,
		deps.Registry,
		deps.Tracer,
		deps.ParallelOperations,
		deps.ResyncInterval,
		deps.MinSyncInterval,
		deps.DrainTimeout,
		deps.QuotaGetter,
		NewRepositoryQuotaChecker(repoGetter),
		deps.IncrementalPolicy,
		deps.WebhookSecretRotationInterval,
		nats.Enabled(deps.NATSSubscriber),
	)

	// The handler must be registered before the source runs: the NATS-backed
	// source has no cache to replay for late handlers.
	registration, err := source.AddEventHandler(rc.EventHandler())
	if err != nil {
		return nil, fmt.Errorf("add repository controller event handler: %w", err)
	}
	return &RepositoryControllerRunner{source: source, registration: registration, controller: rc}, nil
}

// Run starts the delta source, waits until the controller has handled the
// initial list, and then runs the controller workers until ctx is done.
// onStarted is called once the workers are running and onShutdown once ctx is
// done, before the queue drains.
func (r *RepositoryControllerRunner) Run(ctx context.Context, workers int, onStarted, onShutdown func()) error {
	go r.source.Run(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), r.registration.HasSynced) {
		r.controller.queue.ShutDown()
		// The cause tells a dependency failure, such as the NATS subscriber
		// stopping, apart from a shutdown: callers treat context.Canceled as
		// a clean stop.
		return fmt.Errorf("repository controller informer cache sync failed: %w", context.Cause(ctx))
	}

	r.controller.Run(ctx, workers, onStarted, onShutdown)
	return nil
}
