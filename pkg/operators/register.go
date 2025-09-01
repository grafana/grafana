package operators

import (
	"context"
	"crypto/x509"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/urfave/cli/v2"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	deletepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/delete"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/move"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	authrt "github.com/grafana/grafana/apps/provisioning/pkg/auth"
	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
)

func init() {
	server.RegisterOperator(server.Operator{
		Name:        "provisioning-jobs",
		Description: "Watch provisioning jobs and manage job history cleanup",
		RunFunc:     runJobController,
	})
}

type controllerConfig struct {
	restCfg           *rest.Config
	client            *client.Clientset
	historyExpiration time.Duration
}

// QUESTION: is this the right way to do this? will it work?
// directConfigProvider always returns the provided rest.Config.
// implements RestConfigProvider interface
type directConfigProvider struct {
	cfg *rest.Config
}

func NewDirectConfigProvider(cfg *rest.Config) apiserver.RestConfigProvider {
	return &directConfigProvider{cfg: cfg}
}

func (r *directConfigProvider) GetRestConfig(ctx context.Context) (*rest.Config, error) {
	return r.cfg, nil
}

func runJobController(opts standalone.BuildInfo, c *cli.Context, cfg *setting.Cfg) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-job-controller")
	logger.Info("Starting provisioning job controller")

	controllerCfg, err := setupFromConfig(cfg)
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

	// Jobs informer and controller (resync ~60s like in register.go)
	jobInformerFactory := informer.NewSharedInformerFactoryWithOptions(
		controllerCfg.client,
		60*time.Second,
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
			controllerCfg.client,
			controllerCfg.historyExpiration,
		)
		historyJobInformer := historyInformerFactory.Provisioning().V0alpha1().HistoricJobs()
		_, err = controller.NewHistoryJobController(
			controllerCfg.client.ProvisioningV0alpha1(),
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

	// HistoryWriter can be either Loki or the API server
	// TODO: Loki support
	// var jobHistoryWriter jobs.HistoryWriter
	// if b.jobHistoryLoki != nil {
	// 	jobHistoryWriter = b.jobHistoryLoki
	// } else {
	// 	jobHistoryWriter = jobs.NewAPIClientHistoryWriter(provisioningClient.ProvisioningV0alpha1())
	// }
	jobHistoryWriter := jobs.NewAPIClientHistoryWriter(controllerCfg.client.ProvisioningV0alpha1())
	jobStore, err := jobs.NewJobStore(controllerCfg.client.ProvisioningV0alpha1(), 30*time.Second)
	if err != nil {
		return fmt.Errorf("create API client job store: %w", err)
	}

	configProvider := NewDirectConfigProvider(controllerCfg.restCfg)
	clients := resources.NewClientFactory(configProvider)
	parsers := resources.NewParserFactory(clients)

	// HACK: This is connecting to unified storage. It's ok for now as long as dashboards and folders are located in the
	// same cluster and namespace
	// This breaks when we start really trying to support any resource. This is on the search+storage roadmap to support federation at some level.
	// TODO: unified
	var (
		unified      resourcepb.ManagedObjectIndexClient = nil
		unifiedIndex resourcepb.ResourceIndexClient      = nil
	)

	resourceLister := resources.NewResourceLister(unified, unifiedIndex)
	repositoryResources := resources.NewRepositoryResourcesFactory(parsers, clients, resourceLister)

	stageIfPossible := repository.WrapWithStageAndPushIfPossible
	exportWorker := export.NewExportWorker(
		clients,
		repositoryResources,
		export.ExportAll,
		stageIfPossible,
	)

	statusPatcher := controller.NewRepositoryStatusPatcher(controllerCfg.client.ProvisioningV0alpha1())
	syncer := sync.NewSyncer(sync.Compare, sync.FullSync, sync.IncrementalSync)
	syncWorker := sync.NewSyncWorker(
		clients,
		repositoryResources,
		nil, // HACK: we have updated the worker to check for nil
		statusPatcher.Patch,
		syncer,
	)

	cleaner := migrate.NewNamespaceCleaner(clients)
	unifiedStorageMigrator := migrate.NewUnifiedStorageMigrator(
		cleaner,
		exportWorker,
		syncWorker,
	)

	migrationWorker := migrate.NewMigrationWorkerFromUnified(unifiedStorageMigrator)
	deleteWorker := deletepkg.NewWorker(syncWorker, stageIfPossible, repositoryResources)
	moveWorker := move.NewWorker(syncWorker, stageIfPossible, repositoryResources)

	workers := []jobs.Worker{
		deleteWorker,
		exportWorker,
		migrationWorker,
		moveWorker,
		syncWorker,
	}

	// This is basically our own JobQueue system
	// TODO: Add repository getter
	driver, err := jobs.NewConcurrentJobDriver(
		3,              // 3 drivers for now
		20*time.Minute, // Max time for each job
		time.Minute,    // Cleanup jobs
		30*time.Second, // Periodically look for new jobs
		30*time.Second, // Lease renewal interval
		jobStore,
		nil, // TODO: add repository getter
		jobHistoryWriter,
		jobController.InsertNotifications(),
		workers...,
	)

	go func() {
		logger.Info("jobs controller started")
		if err := driver.Run(ctx); err != nil {
			logger.Error("job driver failed", "error", err)
		}
	}()

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

func setupFromConfig(cfg *setting.Cfg) (controllerCfg *controllerConfig, err error) {
	if cfg == nil {
		return nil, fmt.Errorf("no configuration available")
	}

	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	token := gRPCAuth.Key("token").String()
	if token == "" {
		return nil, fmt.Errorf("token is required in [grpc_client_authentication] section")
	}
	tokenExchangeURL := gRPCAuth.Key("token_exchange_url").String()
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [grpc_client_authentication] section")
	}

	operatorSec := cfg.SectionWithEnvOverrides("operator")
	provisioningServerURL := operatorSec.Key("provisioning_server_url").String()
	if provisioningServerURL == "" {
		return nil, fmt.Errorf("provisioning_server_url is required in [operator] section")
	}
	tlsInsecure := operatorSec.Key("tls_insecure").MustBool(false)
	tlsCertFile := operatorSec.Key("tls_cert_file").String()
	tlsKeyFile := operatorSec.Key("tls_key_file").String()
	tlsCAFile := operatorSec.Key("tls_ca_file").String()

	tokenExchangeClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: tokenExchangeURL,
		Token:            token,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	tlsConfig, err := buildTLSConfig(tlsInsecure, tlsCertFile, tlsKeyFile, tlsCAFile)
	if err != nil {
		return nil, fmt.Errorf("failed to build TLS configuration: %w", err)
	}

	config := &rest.Config{
		APIPath: "/apis",
		Host:    provisioningServerURL,
		WrapTransport: transport.WrapperFunc(func(rt http.RoundTripper) http.RoundTripper {
			return authrt.NewRoundTripper(tokenExchangeClient, rt)
		}),
		TLSClientConfig: tlsConfig,
	}

	client, err := client.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning client: %w", err)
	}

	return &controllerConfig{
		restCfg:           config,
		client:            client,
		historyExpiration: operatorSec.Key("history_expiration").MustDuration(0),
	}, nil
}

func buildTLSConfig(insecure bool, certFile, keyFile, caFile string) (rest.TLSClientConfig, error) {
	tlsConfig := rest.TLSClientConfig{
		Insecure: insecure,
	}

	if certFile != "" && keyFile != "" {
		tlsConfig.CertFile = certFile
		tlsConfig.KeyFile = keyFile
	}

	if caFile != "" {
		// caFile is set in operator.ini file
		// nolint:gosec
		caCert, err := os.ReadFile(caFile)
		if err != nil {
			return tlsConfig, fmt.Errorf("failed to read CA certificate file: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return tlsConfig, fmt.Errorf("failed to parse CA certificate")
		}

		tlsConfig.CAData = caCert
	}

	return tlsConfig, nil
}
