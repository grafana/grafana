package provisioning

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"

	"github.com/grafana/dskit/services"
	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/operators/runner"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
)

var RepoOperator = runner.Operator{
	Name:        "provisioning-repo",
	Description: "Watch provisioning repositories",
	Logger:      "provisioning-repo-controller",
	Defaults:    operatorDefaults,
	Build: func(rt *runner.Runtime) (*runner.Parts, error) {
		r, err := newProvisioningRunner(rt)
		if err != nil {
			return nil, err
		}
		manifestWatcher, err := r.ManifestWatcher()
		if err != nil {
			return nil, err
		}
		return &runner.Parts{
			Services: []services.Service{manifestWatcher},
			Run: func(ctx context.Context, ready func()) error {
				return runRepoController(ctx, r, ready)
			},
		}, nil
	},
}

func runRepoController(ctx context.Context, r *ProvisioningRunner, ready func()) error {
	provisioningClient, err := r.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	clients, err := r.ResourceClients()
	if err != nil {
		return fmt.Errorf("failed to get clients: %w", err)
	}

	resourceLister, err := r.ResourceLister()
	if err != nil {
		return err
	}

	repoFactory, err := r.RepositoryFactory()
	if err != nil {
		return fmt.Errorf("failed to get repository factory: %w", err)
	}

	provisioningSec := r.Cfg.SectionWithEnvOverrides("provisioning")
	allowImageRendering := provisioningSec.Key("allow_image_rendering").MustBool(false)
	healthMetricsRecorder, err := r.HealthMetricsRecorder()
	if err != nil {
		return fmt.Errorf("failed to get health metrics recorder: %w", err)
	}

	connectionFactory, err := r.ConnectionFactory()
	if err != nil {
		return fmt.Errorf("failed to get connection factory: %w", err)
	}

	tracer := r.Tracer

	quotaGetter, err := r.QuotaGetter()
	if err != nil {
		return fmt.Errorf("failed to get quota getter: %w", err)
	}

	repoKeys, err := r.ProvisioningKeysLister(apisprovisioning.RepositoryResourceInfo.GroupVersionResource())
	if err != nil {
		return err
	}

	repoController, err := controller.ProvideRepositoryController(controller.RepositoryControllerDeps{
		ProvisioningClient:      provisioningClient,
		NATSSubscriber:          r.Subscriber,
		KeysLister:              repoKeys,
		RelistProjectionMetrics: r.RelistProjectionMetrics(),
		FreshnessMetrics:        r.FreshnessMetrics(),
		HealthMetrics:           healthMetricsRecorder,
		RepoFactory:             repoFactory,
		ConnectionFactory:       connectionFactory,
		ResourceLister:          resourceLister,
		Clients:                 clients,
		// TODO: Consider adding ExistingRepositoriesValidator for reconciliation to detect conflicts
		// that may arise from manual edits or migrations (e.g., duplicate paths, instance sync conflicts).
		Validator:                     repository.NewValidator(allowImageRendering, repoFactory),
		QuotaGetter:                   quotaGetter,
		IncrementalPolicy:             repository.NewIncrementalSyncPolicy(provisioningSec.Key("max_incremental_changes").MustInt(100)),
		Registry:                      r.Registerer,
		Tracer:                        tracer,
		ParallelOperations:            r.Cfg.SectionWithEnvOverrides("operator").Key("parallel_operations").MustInt(10),
		ResyncInterval:                r.Options.Resync,
		MinSyncInterval:               provisioningSec.Key("min_sync_interval").MustDuration(1 * time.Minute),
		DrainTimeout:                  r.Options.DrainTimeout,
		WebhookSecretRotationInterval: provisioningSec.Key("webhook_secret_rotation_interval").MustDuration(30 * 24 * time.Hour),
	})
	if err != nil {
		return err
	}

	return repoController.Run(ctx, r.Options.Workers, ready, func() {})
}
