package provisioning

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"k8s.io/client-go/tools/cache"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/operators/internal/supervision"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/server"
)

func RunRepoController(ctx context.Context, deps server.OperatorDependencies) (runErr error) {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-repo-controller")
	logger.Info("Starting provisioning repo controller")

	controllerCfg, err := setupFromConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup provisioning controller: %w", err)
	}

	ctx, stopSubscriber := supervision.Watch(ctx, controllerCfg.natsSubscriber)
	defer func() {
		deps.HealthNotifier.SetNotReady()
		runErr = errors.Join(runErr, stopSubscriber())
	}()
	if err := services.StartAndAwaitRunning(ctx, controllerCfg.natsSubscriber); err != nil {
		if errors.Is(err, context.Canceled) && ctx.Err() != nil {
			err = context.Cause(ctx)
		}
		return fmt.Errorf("failed to start NATS subscriber: %w", err)
	}

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	clients, err := controllerCfg.Clients()
	if err != nil {
		return fmt.Errorf("failed to get clients: %w", err)
	}
	if err := services.StartAndAwaitRunning(ctx, controllerCfg.manifestWatcher); err != nil {
		return fmt.Errorf("failed to start manifest watcher: %w", err)
	}

	resourceLister, err := controllerCfg.ResourceLister()
	if err != nil {
		return err
	}

	jobs, err := jobs.NewJobStore(provisioningClient.ProvisioningV0alpha1(), jobClaimExpiry, deps.Registerer)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}

	repoFactory, err := controllerCfg.RepositoryFactory()
	if err != nil {
		return fmt.Errorf("failed to get repository factory: %w", err)
	}

	provisioningSec := controllerCfg.Settings.SectionWithEnvOverrides("provisioning")
	allowImageRendering := provisioningSec.Key("allow_image_rendering").MustBool(false)
	validator := repository.NewValidator(allowImageRendering, repoFactory)
	statusPatcher := appcontroller.NewRepositoryStatusPatcher(provisioningClient.ProvisioningV0alpha1())
	// Health checker uses basic validation only - no need to validate against existing repositories
	// since the repository already passed admission validation when it was created/updated.
	// TODO: Consider adding ExistingRepositoriesValidator for reconciliation to detect conflicts
	// that may arise from manual edits or migrations (e.g., duplicate paths, instance sync conflicts).
	healthMetricsRecorder, err := controllerCfg.HealthMetricsRecorder()
	if err != nil {
		return fmt.Errorf("failed to get health metrics recorder: %w", err)
	}

	healthChecker := controller.NewRepositoryHealthChecker(statusPatcher, repository.NewTester(validator), healthMetricsRecorder)

	connectionFactory, err := controllerCfg.ConnectionFactory()
	if err != nil {
		return fmt.Errorf("failed to get connection factory: %w", err)
	}

	tracer, err := controllerCfg.Tracer()
	if err != nil {
		return fmt.Errorf("failed to get tracer: %w", err)
	}

	quotaGetter, err := controllerCfg.QuotaGetter()
	if err != nil {
		return fmt.Errorf("failed to get quota getter: %w", err)
	}

	repoKeys, err := controllerCfg.ProvisioningKeysLister(apisprovisioning.RepositoryResourceInfo.GroupVersionResource())
	if err != nil {
		return err
	}

	repoController, repoSource, hasSynced, err := controller.ProvideRepositoryController(controller.RepositoryControllerDeps{
		ProvisioningClient:            provisioningClient,
		NATSSubscriber:                controllerCfg.natsSubscriber,
		KeysLister:                    repoKeys,
		RelistProjectionMetrics:       controllerCfg.RelistProjectionMetrics(),
		FreshnessMetrics:              controllerCfg.FreshnessMetrics(),
		RepoFactory:                   repoFactory,
		ConnectionFactory:             connectionFactory,
		ResourceLister:                resourceLister,
		Clients:                       clients,
		Jobs:                          jobs,
		HealthChecker:                 healthChecker,
		StatusPatcher:                 statusPatcher,
		QuotaGetter:                   quotaGetter,
		IncrementalPolicy:             repository.NewIncrementalSyncPolicy(provisioningSec.Key("max_incremental_changes").MustInt(100)),
		Registry:                      deps.Registerer,
		Tracer:                        tracer,
		ParallelOperations:            controllerCfg.Settings.SectionWithEnvOverrides("operator").Key("parallel_operations").MustInt(10),
		ResyncInterval:                controllerCfg.ResyncInterval(),
		MinSyncInterval:               provisioningSec.Key("min_sync_interval").MustDuration(1 * time.Minute),
		DrainTimeout:                  controllerCfg.DrainTimeout(),
		WebhookSecretRotationInterval: provisioningSec.Key("webhook_secret_rotation_interval").MustDuration(30 * 24 * time.Hour),
	})
	if err != nil {
		return err
	}
	go repoSource.Run(ctx.Done())

	if !cache.WaitForCacheSync(ctx.Done(), hasSynced) {
		repoController.ShutDownQueue()
		return fmt.Errorf("failed to sync repository informer cache")
	}

	repoController.Run(ctx, controllerCfg.NumberOfWorkers(), func() {
		logger.Info("repository operator is ready")
		deps.HealthNotifier.SetReady()
	}, func() {
		logger.Info("repository operator shutting down")
		deps.HealthNotifier.SetNotReady()
	})
	return nil
}
