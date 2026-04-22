package server

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/ring"
	ringclient "github.com/grafana/dskit/ring/client"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/urfave/cli/v2"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/services/authz"
	zStore "github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/frontend"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"go.opentelemetry.io/otel"
)

// NewModule returns an instance of a ModuleServer, responsible for managing
// dskit modules (services).
func NewModule(opts Options,
	apiOpts api.ServerOptions,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
	reg prometheus.Registerer,
	promGatherer prometheus.Gatherer,
	tracer tracing.Tracer, // Ensures tracing is initialized
	license licensing.Licensing,
	moduleRegisterer ModuleRegisterer,
	storageBackend resource.StorageBackend, // Ensures unified storage backend is initialized
	hooksService *hooks.HooksService,
	storeProvider zStore.StoreProvider,
	reconcileCRDs []schema.GroupVersionResource,
) (*ModuleServer, error) {
	s, err := newModuleServer(opts, apiOpts, features, cfg, storageMetrics, indexMetrics, reg, promGatherer, license, moduleRegisterer, storageBackend, hooksService, storeProvider, reconcileCRDs)
	if err != nil {
		return nil, err
	}

	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newModuleServer(opts Options,
	apiOpts api.ServerOptions,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
	reg prometheus.Registerer,
	promGatherer prometheus.Gatherer,
	license licensing.Licensing,
	moduleRegisterer ModuleRegisterer,
	storageBackend resource.StorageBackend,
	hooksService *hooks.HooksService,
	storeProvider zStore.StoreProvider,
	reconcileCRDs []schema.GroupVersionResource,
) (*ModuleServer, error) {
	rootCtx, shutdownFn := context.WithCancel(context.Background())

	searchClient, err := unified.NewStorageApiSearchClient(cfg, features)
	if err != nil {
		shutdownFn()
		return nil, fmt.Errorf("failed to create storage api search client: %w", err)
	}

	s := &ModuleServer{
		opts:             opts,
		apiOpts:          apiOpts,
		context:          rootCtx,
		shutdownFn:       shutdownFn,
		shutdownFinished: make(chan struct{}),
		log:              log.New("base-server"),
		features:         features,
		cfg:              cfg,
		pidFile:          opts.PidFile,
		version:          opts.Version,
		commit:           opts.Commit,
		buildBranch:      opts.BuildBranch,
		storageMetrics:   storageMetrics,
		indexMetrics:     indexMetrics,
		promGatherer:     promGatherer,
		registerer:       reg,
		license:          license,
		moduleRegisterer: moduleRegisterer,
		storageBackend:   storageBackend,
		hooksService:     hooksService,
		searchClient:     searchClient,
		healthNotifier:   NewHealthNotifier(),
		storeProvider:    storeProvider,
		reconcileCRDs:    reconcileCRDs,
	}

	return s, nil
}

// ModuleServer is responsible for managing the lifecycle of dskit services. The
// ModuleServer has the minimal set of dependencies to launch dskit services,
// but it can be used to launch the entire Grafana server.
type ModuleServer struct {
	opts    Options
	apiOpts api.ServerOptions

	features         featuremgmt.FeatureToggles
	context          context.Context
	shutdownFn       context.CancelFunc
	log              log.Logger
	cfg              *setting.Cfg
	shutdownOnce     sync.Once
	shutdownFinished chan struct{}
	isInitialized    bool
	mtx              sync.Mutex
	storageBackend   resource.StorageBackend
	vectorBackend    vector.VectorBackend
	searchClient     resourcepb.ResourceIndexClient
	storageMetrics   *resource.StorageMetrics
	indexMetrics     *resource.BleveIndexMetrics
	license          licensing.Licensing

	pidFile     string
	version     string
	commit      string
	buildBranch string

	promGatherer prometheus.Gatherer
	registerer   prometheus.Registerer

	MemberlistKVConfig         kv.Config
	httpServerRouter           *mux.Router
	searchServerRing           *ring.Ring
	searchServerRingClientPool *ringclient.Pool

	// grpcService a shared gRPC service/server used by modules to register their gRPC endpoints.
	grpcService *grpcserver.DSKitService

	// moduleRegisterer allows registration of modules provided by other builds (e.g. enterprise).
	moduleRegisterer ModuleRegisterer
	hooksService     *hooks.HooksService

	// storeProvider creates OpenFGA datastores for the Zanzana server.
	storeProvider zStore.StoreProvider

	// reconcileCRDs is the list of namespaced CRDs the MT reconciler translates
	// into Zanzana tuples when running as a standalone zanzana-server module.
	reconcileCRDs []schema.GroupVersionResource

	// healthNotifier is shared between the InstrumentationServer and the OperatorServer
	// so that operators can signal readiness to the /readyz endpoint.
	healthNotifier *HealthNotifier

	// StorageServiceOptions allows injecting extra sql.ServiceOption values into the
	// StorageServer and SearchServer module registrations. This is intended for tests.
	StorageServiceOptions []sql.ServiceOption
}

// init initializes the server and its services.
func (s *ModuleServer) init() error {
	s.mtx.Lock()
	defer s.mtx.Unlock()

	if s.isInitialized {
		return nil
	}
	s.isInitialized = true

	if err := s.writePIDFile(); err != nil {
		return err
	}

	return nil
}

// Run initializes and starts services. This will block until all services have
// exited. To initiate shutdown, call the Shutdown method in another goroutine.
func (s *ModuleServer) Run() error {
	defer close(s.shutdownFinished)

	if err := s.init(); err != nil {
		return err
	}

	s.notifySystemd("READY=1")
	s.log.Debug("Waiting on services...")

	m := modules.New(s.log, s.cfg.Target)

	// only run the instrumentation server module if were not running a module that already contains an http server
	m.RegisterInvisibleModule(modules.InstrumentationServer, func() (services.Service, error) {
		if m.IsModuleEnabled(modules.All) || m.IsModuleEnabled(modules.Core) || m.IsModuleEnabled(modules.FrontendServer) {
			return services.NewBasicService(nil, nil, nil).WithName(modules.InstrumentationServer), nil
		}
		return s.initInstrumentationServer()
	})

	m.RegisterInvisibleModule(modules.GRPCServer, func() (services.Service, error) {
		var err error
		s.grpcService, err = grpcserver.ProvideDSKitService(s.cfg, otel.Tracer("grpc-server"), s.registerer, modules.GRPCServer)
		if err != nil {
			return nil, err
		}
		return s.grpcService, nil
	})

	m.RegisterInvisibleModule(modules.UnifiedBackend, func() (services.Service, error) {
		var err error
		if s.storageBackend == nil {
			// If storage server not being used, disable GC, pruner, and RV manager
			disableStorageServices := !m.IsModuleEnabled(modules.StorageServer)
			s.storageBackend, err = sql.NewStorageBackend(s.cfg, nil, s.registerer, s.storageMetrics, disableStorageServices)
			if err != nil {
				return nil, err
			}
		}
		if backendService, ok := s.storageBackend.(services.Service); ok {
			return backendService, nil
		}
		return services.NewIdleService(nil, nil).WithName(modules.UnifiedBackend), nil
	})

	m.RegisterInvisibleModule(modules.UnifiedVectorBackend, func() (services.Service, error) {
		if s.vectorBackend == nil {
			runMigrations := m.IsModuleEnabled(modules.StorageServer)
			var err error
			s.vectorBackend, err = vector.InitVectorBackend(context.Background(), s.cfg, runMigrations)
			if err != nil {
				return nil, err
			}
		}
		return services.NewIdleService(nil, nil).WithName(modules.UnifiedVectorBackend), nil
	})

	m.RegisterModule(modules.MemberlistKV, s.initMemberlistKV)
	m.RegisterModule(modules.SearchServerRing, s.initSearchServerRing)
	m.RegisterModule(modules.SearchServerDistributor, func() (services.Service, error) {
		svc, err := resource.ProvideSearchDistributorServer(otel.Tracer("index-server-distributor"), s.cfg, s.searchServerRing, s.searchServerRingClientPool, s.grpcService)
		if err != nil {
			return nil, err
		}
		s.grpcService.Health.Register(
			grpcserver.HealthProbeFunc(func(ctx context.Context) (bool, error) {
				return svc.State() == services.Running, nil
			}),
			resourcepb.ResourceIndex_ServiceDesc.ServiceName,
			resourcepb.ManagedObjectIndex_ServiceDesc.ServiceName,
		)
		return svc, nil
	})

	m.RegisterModule(modules.Core, func() (services.Service, error) {
		return NewService(s.cfg, s.opts, s.apiOpts)
	})

	// TODO: uncomment this once the apiserver is ready to be run as a standalone target
	//if s.features.IsEnabled(featuremgmt.FlagGrafanaAPIServer) {
	//	m.RegisterModule(modules.GrafanaAPIServer, func() (services.Service, error) {
	//		return grafanaapiserver.New(path.Join(s.cfg.DataPath, "k8s"))
	//	})
	//} else {
	//	s.log.Debug("apiserver feature is disabled")
	//}

	m.RegisterModule(modules.StorageServer, func() (services.Service, error) {
		// Only set docBuilders and indexMetrics if enable_search is true
		var docBuilders resource.DocumentBuilderSupplier
		var indexMetrics *resource.BleveIndexMetrics
		if s.cfg.EnableSearch {
			s.log.Warn("Support for 'enable_search' config with 'storage-server' target is deprecated and will be removed in a future release. Please use the 'search-server' target instead.")
			var err error
			docBuilders, err = InitializeDocumentBuilders(s.cfg)
			if err != nil {
				return nil, err
			}
			indexMetrics = s.indexMetrics
		}
		svc, err := sql.ProvideUnifiedStorageGrpcService(s.cfg, s.features, s.log, s.registerer, docBuilders, s.storageMetrics, indexMetrics, s.searchServerRing, s.MemberlistKVConfig, s.httpServerRouter, s.storageBackend, s.vectorBackend, s.searchClient, s.grpcService, s.StorageServiceOptions...)
		if err != nil {
			return nil, err
		}
		probe, ok := svc.(grpcserver.HealthProbe)
		s.grpcService.Health.Register(grpcserver.HealthProbeFunc(func(ctx context.Context) (bool, error) {
			if svc.State() != services.Running {
				return false, nil
			}
			if ok {
				return probe.CheckHealth(ctx)
			}
			return true, nil
		}),
			resourcepb.ResourceStore_ServiceDesc.ServiceName,
			resourcepb.ResourceIndex_ServiceDesc.ServiceName,
			resourcepb.ManagedObjectIndex_ServiceDesc.ServiceName,
			resourcepb.BlobStore_ServiceDesc.ServiceName,
			resourcepb.BulkStore_ServiceDesc.ServiceName,
			resourcepb.Diagnostics_ServiceDesc.ServiceName,
			resourcepb.Quotas_ServiceDesc.ServiceName,
		)

		return svc, nil
	})

	m.RegisterModule(modules.SearchServer, func() (services.Service, error) {
		docBuilders, err := InitializeDocumentBuilders(s.cfg)
		if err != nil {
			return nil, err
		}
		svc, err := sql.ProvideSearchGRPCService(s.cfg, s.features, s.log, s.registerer, docBuilders, s.indexMetrics, s.searchServerRing, s.MemberlistKVConfig, s.httpServerRouter, s.storageBackend, s.vectorBackend, s.grpcService, s.StorageServiceOptions...)
		if err != nil {
			return nil, err
		}
		probe, ok := svc.(grpcserver.HealthProbe)
		s.grpcService.Health.Register(grpcserver.HealthProbeFunc(func(ctx context.Context) (bool, error) {
			if svc.State() != services.Running {
				return false, nil
			}
			if ok {
				return probe.CheckHealth(ctx)
			}
			return true, nil
		}),
			resourcepb.ResourceIndex_ServiceDesc.ServiceName,
			resourcepb.ManagedObjectIndex_ServiceDesc.ServiceName,
			resourcepb.Diagnostics_ServiceDesc.ServiceName,
		)
		return svc, nil
	})

	m.RegisterModule(modules.ZanzanaServer, func() (services.Service, error) {
		return authz.ProvideZanzanaService(s.cfg, s.features, s.registerer, s.storeProvider, s.reconcileCRDs)
	})

	m.RegisterModule(modules.FrontendServer, func() (services.Service, error) {
		return frontend.ProvideFrontendService(s.cfg, s.features, s.promGatherer, s.registerer, s.license, s.hooksService)
	})

	m.RegisterModule(modules.OperatorServer, s.initOperatorServer)

	m.RegisterModule(modules.All, nil)

	// Register modules provided by other builds (e.g. enterprise).
	s.moduleRegisterer.RegisterModules(m)

	return m.Run(s.context)
}

func (s *ModuleServer) initOperatorServer() (services.Service, error) {
	operatorName := os.Getenv("GF_OPERATOR_NAME")
	if operatorName == "" {
		s.log.Debug("GF_OPERATOR_NAME environment variable empty or unset, can't start operator")
		return nil, nil
	}

	for _, op := range GetRegisteredOperators() {
		if op.Name == operatorName {
			return services.NewBasicService(
				nil,
				func(ctx context.Context) error {
					cliContext := cli.NewContext(&cli.App{}, nil, nil)
					deps := OperatorDependencies{
						BuildInfo: standalone.BuildInfo{
							Version:     s.version,
							Commit:      s.commit,
							BuildBranch: s.buildBranch,
						},
						CLIContext:     cliContext,
						Config:         s.cfg,
						Registerer:     s.registerer,
						HealthNotifier: s.healthNotifier,
					}
					return op.RunFunc(deps)
				},
				nil,
			).WithName("operator"), nil
		}
	}

	return nil, fmt.Errorf("unknown operator: %s. available operators: %v", operatorName, GetRegisteredOperatorNames())
}

// Shutdown initiates Grafana graceful shutdown. This shuts down all
// running background services. Since Run blocks Shutdown supposed to
// be run from a separate goroutine.
func (s *ModuleServer) Shutdown(ctx context.Context, reason string) error {
	var err error
	s.shutdownOnce.Do(func() {
		s.log.Info("Shutdown started", "reason", reason)
		// Call cancel func to stop background services.
		s.shutdownFn()
		// Wait for server to shut down
		select {
		case <-s.shutdownFinished:
			s.log.Debug("Finished waiting for server to shut down")
		case <-ctx.Done():
			s.log.Warn("Timed out while waiting for server to shut down")
			err = fmt.Errorf("timeout waiting for shutdown")
		}
	})

	return err
}

// writePIDFile retrieves the current process ID and writes it to file.
func (s *ModuleServer) writePIDFile() error {
	if s.pidFile == "" {
		return nil
	}

	// Ensure the required directory structure exists.
	err := os.MkdirAll(filepath.Dir(s.pidFile), 0700)
	if err != nil {
		s.log.Error("Failed to verify pid directory", "error", err)
		return fmt.Errorf("failed to verify pid directory: %s", err)
	}

	// Retrieve the PID and write it to file.
	pid := strconv.Itoa(os.Getpid())
	if err := os.WriteFile(s.pidFile, []byte(pid), 0644); err != nil {
		s.log.Error("Failed to write pidfile", "error", err)
		return fmt.Errorf("failed to write pidfile: %s", err)
	}

	s.log.Info("Writing PID file", "path", s.pidFile, "pid", pid)
	return nil
}

// notifySystemd sends state notifications to systemd.
func (s *ModuleServer) notifySystemd(state string) {
	notifySocket := os.Getenv("NOTIFY_SOCKET")
	if notifySocket == "" {
		s.log.Debug(
			"NOTIFY_SOCKET environment variable empty or unset, can't send systemd notification")
		return
	}

	socketAddr := &net.UnixAddr{
		Name: notifySocket,
		Net:  "unixgram",
	}
	conn, err := net.DialUnix(socketAddr.Net, nil, socketAddr)
	if err != nil {
		s.log.Warn("Failed to connect to systemd", "err", err, "socket", notifySocket)
		return
	}
	defer func() {
		if err := conn.Close(); err != nil {
			s.log.Warn("Failed to close connection", "err", err)
		}
	}()

	_, err = conn.Write([]byte(state))
	if err != nil {
		s.log.Warn("Failed to write notification to systemd", "err", err)
	}
}
