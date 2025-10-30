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
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"

	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
)

func RunRepoController(deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-repo-controller")
	logger.Info("Starting provisioning repo controller")

	controllerCfg, err := getRepoControllerConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup operator: %w", err)
	}

	tracingConfig, err := tracing.ProvideTracingConfig(deps.Config)
	if err != nil {
		return fmt.Errorf("failed to provide tracing config: %w", err)
	}

	tracer, err := tracing.ProvideService(tracingConfig)
	if err != nil {
		return fmt.Errorf("failed to provide tracing service: %w", err)
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

	informerFactory := informer.NewSharedInformerFactoryWithOptions(
		controllerCfg.provisioningClient,
		controllerCfg.resyncInterval,
	)

	resourceLister := resources.NewResourceLister(controllerCfg.unified)
	jobs, err := jobs.NewJobStore(controllerCfg.provisioningClient.ProvisioningV0alpha1(), 30*time.Second, deps.Registerer)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}

	allowedTargets := []v0alpha1.SyncTargetType{}
	for _, target := range controllerCfg.allowedTargets {
		allowedTargets = append(allowedTargets, v0alpha1.SyncTargetType(target))
	}
	validator := repository.NewValidator(controllerCfg.minSyncInterval, allowedTargets, controllerCfg.allowImageRendering)
	statusPatcher := appcontroller.NewRepositoryStatusPatcher(controllerCfg.provisioningClient.ProvisioningV0alpha1())
	healthChecker := controller.NewHealthChecker(statusPatcher, deps.Registerer, repository.NewSimpleRepositoryTester(validator))

	repoInformer := informerFactory.Provisioning().V0alpha1().Repositories()
	controller, err := controller.NewRepositoryController(
		controllerCfg.provisioningClient.ProvisioningV0alpha1(),
		repoInformer,
		controllerCfg.repoFactory,
		resourceLister,
		controllerCfg.clients,
		jobs,
		nil, // dualwrite -- standalone operator assumes it is backed by unified storage
		healthChecker,
		statusPatcher,
		deps.Registerer,
		tracer,
		controllerCfg.parallelOperations,
	)
	if err != nil {
		return fmt.Errorf("failed to create repository controller: %w", err)
	}

	informerFactory.Start(ctx.Done())
	if !cache.WaitForCacheSync(ctx.Done(), repoInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync informer cache")
	}

	controller.Run(ctx, controllerCfg.workerCount)
	return nil
}

type repoControllerConfig struct {
	provisioningControllerConfig
	workerCount         int
	parallelOperations  int
	allowedTargets      []string
	allowImageRendering bool
	minSyncInterval     time.Duration
}

func getRepoControllerConfig(cfg *setting.Cfg, registry prometheus.Registerer) (*repoControllerConfig, error) {
	controllerCfg, err := setupFromConfig(cfg, registry)
	if err != nil {
		return nil, err
	}

	allowedTargets := []string{}
	cfg.SectionWithEnvOverrides("provisioning").Key("allowed_targets").Strings("|")
	if len(allowedTargets) == 0 {
		allowedTargets = []string{"folder"}
	}

	return &repoControllerConfig{
		provisioningControllerConfig: *controllerCfg,
		allowedTargets:               allowedTargets,
		workerCount:                  cfg.SectionWithEnvOverrides("operator").Key("worker_count").MustInt(1),
		parallelOperations:           cfg.SectionWithEnvOverrides("operator").Key("parallel_operations").MustInt(10),
		allowImageRendering:          cfg.SectionWithEnvOverrides("provisioning").Key("allow_image_rendering").MustBool(false),
		minSyncInterval:              cfg.SectionWithEnvOverrides("provisioning").Key("min_sync_interval").MustDuration(1 * time.Minute),
	}, nil
}
