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
	grpc "google.golang.org/grpc"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	deletepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/delete"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/move"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	secretdecrypt "github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

type localConfig struct {
	homePath          string
	permittedPrefixes []string
}

type controllerConfig struct {
	availableRepositoryTypes map[provisioning.RepositoryType]struct{}
	localConfig              localConfig
	repositoryTypes          []string
	tokenExchangeClient      *authn.TokenExchangeClient
	restCfg                  *rest.Config
	client                   *client.Clientset
	historyExpiration        time.Duration
	secretsTls               secretdecrypt.TLSConfig
	secretsGrpcServerAddress string
	unifiedCfg               unifiedStorageConfig
}

// directConfigProvider is a simple RestConfigProvider that always returns the same rest.Config
// it implements apiserver.RestConfigProvider
type directConfigProvider struct {
	cfg *rest.Config
}

func NewDirectConfigProvider(cfg *rest.Config) apiserver.RestConfigProvider {
	return &directConfigProvider{cfg: cfg}
}

func (r *directConfigProvider) GetRestConfig(ctx context.Context) (*rest.Config, error) {
	return r.cfg, nil
}

// unifiedStorageFactory implements resources.ResourceStore
// and provides a new unified storage client for each request
// HACK: This logic directly connects to unified storage. It works for now as long as dashboards and folders
// reside within the same cluster and namespace. However, this approach is considered suboptimal and
// is not recommended for broader use. It will fail when we expand support for additional resources.
// Future improvements on the search and storage roadmap, such as introducing resource federation,
// should eliminate the need for this workaround. Once global search capabilities are available,
// they should replace this implementation.
type unifiedStorageFactory struct {
	cfg       resource.RemoteResourceClientConfig
	tracer    trace.Tracer
	conn      grpc.ClientConnInterface
	indexConn grpc.ClientConnInterface
}

func NewUnifiedStorageClientFactory(cfg unifiedStorageConfig, tracer tracing.Tracer) (resources.ResourceStore, error) {
	registry := prometheus.NewPedanticRegistry()
	conn, err := unified.GrpcConn(cfg.GrpcAddress, registry)
	if err != nil {
		return nil, fmt.Errorf("create unified storage gRPC connection: %w", err)
	}

	indexAddress := cfg.GrpcIndexAddress
	if indexAddress == "" {
		indexAddress = cfg.GrpcAddress
	}

	indexConn, err := unified.GrpcConn(indexAddress, registry)
	if err != nil {
		return nil, fmt.Errorf("create unified storage index gRPC connection: %w", err)
	}

	return &unifiedStorageFactory{
		tracer:    tracer,
		conn:      conn,
		indexConn: indexConn,
	}, nil
}

func (s *unifiedStorageFactory) getClient(ctx context.Context) (resource.ResourceClient, error) {
	return resource.NewRemoteResourceClient(s.tracer, s.conn, s.indexConn, s.cfg)
}

func (s *unifiedStorageFactory) CountManagedObjects(ctx context.Context, in *resourcepb.CountManagedObjectsRequest, opts ...grpc.CallOption) (*resourcepb.CountManagedObjectsResponse, error) {
	client, err := s.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("get unified storage client: %w", err)
	}
	return client.CountManagedObjects(ctx, in, opts...)
}

func (s *unifiedStorageFactory) ListManagedObjects(ctx context.Context, in *resourcepb.ListManagedObjectsRequest, opts ...grpc.CallOption) (*resourcepb.ListManagedObjectsResponse, error) {
	client, err := s.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("get unified storage client: %w", err)
	}

	return client.ListManagedObjects(ctx, in, opts...)
}

func (s *unifiedStorageFactory) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	client, err := s.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("get unified storage client: %w", err)
	}

	return client.Search(ctx, in, opts...)
}

func (s *unifiedStorageFactory) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	client, err := s.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("get unified storage client: %w", err)
	}

	return client.GetStats(ctx, in, opts...)
}

type unifiedStorageConfig struct {
	GrpcAddress      string
	GrpcIndexAddress string
	ClientConfig     resource.RemoteResourceClientConfig
}

func runJobController(opts standalone.BuildInfo, c *cli.Context, cfg *setting.Cfg) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-job-controller")
	logger.Info("Starting provisioning job controller")

	// TODO: we should setup tracing properly
	// https://github.com/grafana/git-ui-sync-project/issues/507
	tracer := tracing.NewNoopTracerService()

	// FIXME: we should create providers that can be used here, and API server
	// https://github.com/grafana/git-ui-sync-project/issues/468
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
	// TODO: Loki configuration and setup in the same way we do for the API server
	// https://github.com/grafana/git-ui-sync-project/issues/508
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

	// HACK: This logic directly connects to unified storage. It works for now as long as dashboards and folders
	// reside within the same cluster and namespace. However, this approach is considered suboptimal and
	// is not recommended for broader use. It will fail when we expand support for additional resources.
	// Future improvements on the search and storage roadmap, such as introducing resource federation,
	// should eliminate the need for this workaround. Once global search capabilities are available,
	// they should replace this implementation.
	unified, err := NewUnifiedStorageClientFactory(tracer)
	if err != nil {
		return fmt.Errorf("create unified storage client: %w", err)
	}

	resourceLister := resources.NewResourceLister(unified)
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

	decryptSvc, err := secretdecrypt.NewGRPCDecryptClientWithTLS(
		controllerCfg.tokenExchangeClient,
		tracer,
		controllerCfg.secretsGrpcServerAddress,
		controllerCfg.secretsTls,
	)
	if err != nil {
		return fmt.Errorf("create decrypt service: %w", err)
	}
	decrypter := repository.ProvideDecrypter(decryptSvc)

	// TODO: This depends on the different flavor of Grafana
	// https://github.com/grafana/git-ui-sync-project/issues/495
	extras := make([]repository.Extra, 0, len(controllerCfg.availableRepositoryTypes))
	for t := range controllerCfg.availableRepositoryTypes {
		switch t {
		case provisioning.GitHubRepositoryType:
			extras = append(extras, github.Extra(
				decrypter,
				github.ProvideFactory(),
				nil, // We don't need the WebhookURL for the execution of jobs, only for the repository controller
			),
			)
		case provisioning.LocalRepositoryType:
			extras = append(extras, local.Extra(
				controllerCfg.localConfig.homePath,
				controllerCfg.localConfig.permittedPrefixes,
			))
		default:
			return fmt.Errorf("unsupported repository type: %s", t)
		}
	}

	repoFactory, err := repository.ProvideFactory(extras)
	if err != nil {
		return fmt.Errorf("create repository factory: %w", err)
	}

	repoGetter := resources.NewRepositoryGetter(
		repoFactory,
		controllerCfg.client.ProvisioningV0alpha1(),
	)

	// This is basically our own JobQueue system
	driver, err := jobs.NewConcurrentJobDriver(
		3,              // 3 drivers for now
		20*time.Minute, // Max time for each job
		time.Minute,    // Cleanup jobs
		30*time.Second, // Periodically look for new jobs
		30*time.Second, // Lease renewal interval
		jobStore,
		repoGetter,
		jobHistoryWriter,
		jobController.InsertNotifications(),
		workers...,
	)
	if err != nil {
		return fmt.Errorf("create concurrent job driver: %w", err)
	}

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

	// TODO: This depends on the different flavor of Grafana
	// https://github.com/grafana/git-ui-sync-project/issues/495
	repositoryTypes := operatorSec.Key("repository_types").Strings(",")
	availableRepositoryTypes := make(map[provisioning.RepositoryType]struct{})
	for _, t := range repositoryTypes {
		if t != string(provisioning.LocalRepositoryType) && t != string(provisioning.GitHubRepositoryType) {
			return nil, fmt.Errorf("unsupported repository type: %s", t)
		}

		availableRepositoryTypes[provisioning.RepositoryType(t)] = struct{}{}
	}

	// local
	localCfg := localConfig{
		homePath:          operatorSec.Key("local_home_path").String(),
		permittedPrefixes: operatorSec.Key("local_permitted_prefixes").Strings(","),
	}

	// Decrypt Service
	secretsSec := cfg.SectionWithEnvOverrides("secrets_manager")
	secretsTls := secretdecrypt.TLSConfig{
		UseTLS:             secretsSec.Key("grpc_server_use_tls").MustBool(true),
		CAFile:             secretsSec.Key("grpc_server_tls_ca_file").String(),
		ServerName:         secretsSec.Key("grpc_server_tls_server_name").String(),
		InsecureSkipVerify: secretsSec.Key("grpc_server_tls_skip_verify").MustBool(false),
	}

	// Unified Storage
	unifiedStorageSec := cfg.SectionWithEnvOverrides("unified_storage")
	unifiedCfg := unifiedStorageConfig{
		GrpcAddress:      unifiedStorageSec.Key("grpc_address").String(),
		GrpcIndexAddress: unifiedStorageSec.Key("grpc_index_address").String(),
		ClientConfig: resource.RemoteResourceClientConfig{
			Token:            token,
			TokenExchangeURL: tokenExchangeURL,
			Audiences:        unifiedStorageSec.Key("grpc_client_authentication_audiences").Strings(","),
			Namespace:        "", // TODO: will this work?
			AllowInsecure:    unifiedStorageSec.Key("grpc_server_tls_skip_verify").MustBool(false),
		},
	}

	return &controllerConfig{
		availableRepositoryTypes: availableRepositoryTypes,
		localConfig:              localCfg,
		tokenExchangeClient:      tokenExchangeClient,
		restCfg:                  config,
		client:                   client,
		secretsTls:               secretsTls,
		unifiedCfg:               unifiedCfg,
		secretsGrpcServerAddress: secretsSec.Key("grpc_server_address").String(),
		historyExpiration:        operatorSec.Key("history_expiration").MustDuration(0),
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
