package provisioning

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/operators/internal/supervision"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/server"
)

func RunRepoController(ctx context.Context, deps server.OperatorDependencies) (runErr error) {
	logger := newOperatorLogger("provisioning-repo-controller")
	logger.Info("Starting provisioning repo controller")

	controllerCfg, err := setupFromConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup provisioning controller: %w", err)
	}

	manifestWatcher, err := controllerCfg.ManifestWatcher()
	if err != nil {
		return err
	}
	ctx, stopServices, err := supervision.Start(ctx, controllerCfg.natsSubscriber, manifestWatcher)
	defer func() {
		deps.HealthNotifier.SetNotReady()
		runErr = errors.Join(runErr, stopServices())
	}()
	if err != nil {
		return err
	}

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	clients, err := controllerCfg.Clients()
	if err != nil {
		return fmt.Errorf("failed to get clients: %w", err)
	}

	resourceLister, err := controllerCfg.ResourceLister()
	if err != nil {
		return err
	}

	repoFactory, err := controllerCfg.RepositoryFactory()
	if err != nil {
		return fmt.Errorf("failed to get repository factory: %w", err)
	}

	provisioningSec := controllerCfg.Settings.SectionWithEnvOverrides("provisioning")
	allowImageRendering := provisioningSec.Key("allow_image_rendering").MustBool(false)
	healthMetricsRecorder, err := controllerCfg.HealthMetricsRecorder()
	if err != nil {
		return fmt.Errorf("failed to get health metrics recorder: %w", err)
	}

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

	repoController, err := controller.ProvideRepositoryController(controller.RepositoryControllerDeps{
		ProvisioningClient:      provisioningClient,
		NATSSubscriber:          controllerCfg.natsSubscriber,
		KeysLister:              repoKeys,
		RelistProjectionMetrics: controllerCfg.RelistProjectionMetrics(),
		FreshnessMetrics:        controllerCfg.FreshnessMetrics(),
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

	return repoController.Run(ctx, controllerCfg.NumberOfWorkers(), func() {
		logger.Info("repository operator is ready")
		deps.HealthNotifier.SetReady()
	}, func() {
		logger.Info("repository operator shutting down")
		deps.HealthNotifier.SetNotReady()
	})
}
