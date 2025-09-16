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
	"github.com/urfave/cli/v2"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/setting"

	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
)

func RunRepoController(opts standalone.BuildInfo, c *cli.Context, cfg *setting.Cfg) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-repo-controller")
	logger.Info("Starting provisioning repo controller")

	controllerCfg, err := getRepoControllerConfig(cfg)
	if err != nil {
		return fmt.Errorf("failed to setup operator: %w", err)
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
	jobs, err := jobs.NewJobStore(controllerCfg.provisioningClient.ProvisioningV0alpha1(), 30*time.Second)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}
	statusPatcher := appcontroller.NewRepositoryStatusPatcher(controllerCfg.provisioningClient.ProvisioningV0alpha1())
	healthChecker := controller.NewHealthChecker(statusPatcher)

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
	workerCount int
}

func getRepoControllerConfig(cfg *setting.Cfg) (*repoControllerConfig, error) {
	controllerCfg, err := setupFromConfig(cfg)
	if err != nil {
		return nil, err
	}
	return &repoControllerConfig{
		provisioningControllerConfig: *controllerCfg,
		workerCount:                  cfg.SectionWithEnvOverrides("operator").Key("worker_count").MustInt(1),
	}, nil
}
