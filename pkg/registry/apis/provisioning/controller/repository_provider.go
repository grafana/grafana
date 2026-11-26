package controller

import (
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
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
	// The relist and freshness metrics are registered once per process and
	// shared with the other provisioning delta sources.
	RelistProjectionMetrics *informer.RelistProjectionMetrics
	FreshnessMetrics        *informer.FreshnessMetrics

	RepoFactory       repository.Factory
	ConnectionFactory connection.Factory
	ResourceLister    resources.ResourceLister
	Clients           resources.ClientFactory
	Jobs              interface {
		jobs.Queue
		jobs.Store
	}
	HealthChecker     *RepositoryHealthChecker
	StatusPatcher     StatusPatcher
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

// ProvideRepositoryController builds the repository controller shared by the
// provisioning API server and the standalone repository operator: a
// RepositoryController registered on the repository DeltaSource selected by
// deps.NATSSubscriber.
//
// The returned source is not started; the caller owns its lifecycle and must
// call Run. The returned InformerSynced reports when the controller's handler
// has processed the initial list, and callers must wait for it before running
// the controller.
func ProvideRepositoryController(deps RepositoryControllerDeps) (*RepositoryController, informer.DeltaSource, cache.InformerSynced, error) {
	source, repoGetter := informer.NewRepositoryDeltaSource(
		deps.NATSSubscriber,
		deps.ProvisioningClient,
		deps.KeysLister,
		deps.ResyncInterval,
		deps.RelistProjectionMetrics,
		deps.FreshnessMetrics,
	)

	rc := NewRepositoryController(
		deps.ProvisioningClient.ProvisioningV0alpha1(),
		repoGetter,
		deps.RepoFactory,
		deps.ConnectionFactory,
		deps.ResourceLister,
		deps.Clients,
		deps.Jobs,
		deps.HealthChecker,
		deps.StatusPatcher,
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
	reg, err := source.AddEventHandler(rc.EventHandler())
	if err != nil {
		return nil, nil, nil, fmt.Errorf("add repository controller event handler: %w", err)
	}
	return rc, source, reg.HasSynced, nil
}
