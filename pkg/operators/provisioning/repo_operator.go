package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/server"

	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
)

func RunRepoController(deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-repo-controller")
	logger.Info("Starting provisioning repo controller")

	controllerCfg, err := setupFromConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup provisioning controller: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("Received shutdown signal, stopping controllers")
		cancel()
	}()

	provisioningClient, err := controllerCfg.ProvisioningClient()
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	informerFactory := informer.NewSharedInformerFactoryWithOptions(
		provisioningClient,
		controllerCfg.ResyncInterval(),
	)

	unified, err := controllerCfg.UnifiedStorageClient()
	if err != nil {
		return fmt.Errorf("failed to get unified storage client: %w", err)
	}

	resourceLister := resources.NewResourceLister(unified)
	jobs, err := jobs.NewJobStore(provisioningClient.ProvisioningV0alpha1(), 30*time.Second, deps.Registerer)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}

	repoFactory, err := controllerCfg.RepositoryFactory()
	if err != nil {
		return fmt.Errorf("failed to get repository factory: %w", err)
	}

	allowImageRendering := controllerCfg.Settings.SectionWithEnvOverrides("provisioning").Key("allow_image_rendering").MustBool(false)
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

	quotaGetter, err := controllerCfg.QuotaLimitsProvider()
	if err != nil {
		return fmt.Errorf("failed to get quota getter: %w", err)
	}

	repoInformer := informerFactory.Provisioning().V0alpha1().Repositories()
	clients, err := controllerCfg.Clients()
	if err != nil {
		return fmt.Errorf("failed to get clients: %w", err)
	}

	controller, err := controller.NewRepositoryController(
		provisioningClient.ProvisioningV0alpha1(),
		repoInformer,
		repoFactory,
		connectionFactory,
		resourceLister,
		clients,
		jobs,
		healthChecker,
		statusPatcher,
		deps.Registerer,
		tracer,
		controllerCfg.Settings.SectionWithEnvOverrides("operator").Key("parallel_operations").MustInt(10),
		controllerCfg.ResyncInterval(),
		controllerCfg.Settings.SectionWithEnvOverrides("provisioning").Key("min_sync_interval").MustDuration(1*time.Minute),
		quotaGetter,
	)
	if err != nil {
		return fmt.Errorf("failed to create repository controller: %w", err)
	}

	informerFactory.Start(ctx.Done())
	if !cache.WaitForCacheSync(ctx.Done(), repoInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync informer cache")
	}

	controller.Run(ctx, controllerCfg.NumberOfWorkers())
	return nil
}
