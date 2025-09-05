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
	"github.com/urfave/cli/v2"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
)

func RunJobController(opts standalone.BuildInfo, c *cli.Context, cfg *setting.Cfg) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-job-controller")
	logger.Info("Starting provisioning job controller")

	controllerCfg, err := getJobsControllerConfig(cfg)
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

	// Use unified storage client and API clients for testing purposes.
	// TODO: remove this once the processing logic is in place
	// https://github.com/grafana/git-ui-sync-project/issues/467
	go temporaryPeriodicTestClients(ctx, logger, controllerCfg)

	// Jobs informer and controller (resync ~60s like in register.go)
	jobInformerFactory := informer.NewSharedInformerFactoryWithOptions(
		controllerCfg.provisioningClient,
		controllerCfg.resyncInterval,
	)
	jobInformer := jobInformerFactory.Provisioning().V0alpha1().Jobs()
	jobController, err := controller.NewJobController(jobInformer)
	if err != nil {
		return fmt.Errorf("failed to create job controller: %w", err)
	}

	logger.Info("jobs controller started")
	notifications := jobController.InsertNotifications()
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-notifications:
				logger.Info("job create notification received")
			}
		}
	}()

	var startHistoryInformers func()
	if controllerCfg.historyExpiration > 0 {
		// History jobs informer and controller (separate factory with resync == expiration)
		historyInformerFactory := informer.NewSharedInformerFactoryWithOptions(
			controllerCfg.provisioningClient,
			controllerCfg.historyExpiration,
		)
		historyJobInformer := historyInformerFactory.Provisioning().V0alpha1().HistoricJobs()
		_, err = controller.NewHistoryJobController(
			controllerCfg.provisioningClient.ProvisioningV0alpha1(),
			historyJobInformer,
			controllerCfg.historyExpiration,
		)
		if err != nil {
			return fmt.Errorf("failed to create history job controller: %w", err)
		}
		logger.Info("history cleanup enabled", "expiration", controllerCfg.historyExpiration.String())
		startHistoryInformers = func() { historyInformerFactory.Start(ctx.Done()) }
	} else {
		startHistoryInformers = func() {}
	}

	// Start informers
	go jobInformerFactory.Start(ctx.Done())
	go startHistoryInformers()

	// Optionally wait for job cache sync; history cleanup can rely on resync events
	if !cache.WaitForCacheSync(ctx.Done(), jobInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync job informer cache")
	}

	<-ctx.Done()
	return nil
}

type jobsControllerConfig struct {
	provisioningControllerConfig
	historyExpiration time.Duration
}

func getJobsControllerConfig(cfg *setting.Cfg) (*jobsControllerConfig, error) {
	controllerCfg, err := setupFromConfig(cfg)
	if err != nil {
		return nil, err
	}
	return &jobsControllerConfig{
		provisioningControllerConfig: *controllerCfg,
		historyExpiration:            cfg.SectionWithEnvOverrides("operator").Key("history_expiration").MustDuration(0),
	}, nil
}

// Use unified storage and API clients for testing purposes.
// TODO: remove this once the processing logic is in place
// https://github.com/grafana/git-ui-sync-project/issues/467
func temporaryPeriodicTestClients(ctx context.Context, logger logging.Logger, controllerCfg *jobsControllerConfig) {
	tick := time.NewTicker(controllerCfg.resyncInterval)
	logger.Info("starting periodic using clients", "interval", controllerCfg.resyncInterval.String())
	fetchAndLog := func(ctx context.Context) {
		ctx, _, err := identity.WithProvisioningIdentity(ctx, "*") // "*" grants us access to all namespaces.
		if err != nil {
			logger.Error("failed to set identity", "error", err)
			return
		}

		resp, err := controllerCfg.unified.CountManagedObjects(ctx, &resourcepb.CountManagedObjectsRequest{
			Kind: string(utils.ManagerKindRepo),
		})
		if err != nil {
			logger.Error("failed to list managed objects", "error", err)
		} else {
			if len(resp.Items) == 0 {
				logger.Info("no managed objects found")
			} else {
				for _, obj := range resp.Items {
					logger.Info("manage object counts", "item", obj)
				}
			}
		}

		// List all supported resources
		client, err := controllerCfg.clients.Clients(ctx, "")
		if err != nil {
			logger.Error("failed to get resource clients", "error", err)
			return
		}

		for kind, gvr := range resources.SupportedProvisioningResources {
			logger := logger.With("kind", kind, "gvr", gvr.String())
			logger.Info("fetching resources")

			resourceClient, gvk, err := client.ForResource(ctx, gvr)
			if err != nil {
				logger.Error("failed to get resource client", "error", err)
				continue
			}

			logger = logger.With("gvk", gvk.String())
			list, err := resourceClient.List(ctx, metav1.ListOptions{})
			if err != nil {
				logger.Error("failed to list resources", "error", err)
				continue
			}

			for _, item := range list.Items {
				logger.Info("resource", "name", item.GetName(), "namespace", item.GetNamespace())
			}
		}
	}

	fetchAndLog(ctx) // Initial fetch
	for {
		select {
		case <-ctx.Done():
			tick.Stop()
			return
		case <-tick.C:
			// Periodic fetch
			fetchAndLog(ctx)
		}
	}
}
