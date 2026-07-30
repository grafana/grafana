package authz

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/middleware"
	"github.com/grafana/dskit/services"
	grpc_retry "github.com/grpc-ecosystem/go-grpc-middleware/retry"
	"github.com/grpc-ecosystem/go-grpc-middleware/util/metautils"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	healthv1pb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/keepalive"
	"k8s.io/apimachinery/pkg/runtime/schema"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/leaderelection/kvlease"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	zClient "github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	zServer "github.com/grafana/grafana/pkg/services/authz/zanzana/server"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/server/reconciler"
	zStore "github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// ProvideZanzanaClient used to register ZanzanaClient.
// It will also start an embedded ZanzanaSever if mode is set to "embedded".
func ProvideZanzanaClient(cfg *setting.Cfg, db db.DB, zanzanaServer zanzana.Server, features featuremgmt.FeatureToggles, reg prometheus.Registerer) (zanzana.Client, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		return zClient.NewNoopClient(), nil
	}

	switch cfg.ZanzanaClient.Mode {
	case setting.ZanzanaModeClient:
		zanzanaConfig := ZanzanaClientConfig{
			Addr:             cfg.ZanzanaClient.Addr,
			Token:            cfg.ZanzanaClient.Token,
			TokenExchangeURL: cfg.ZanzanaClient.TokenExchangeURL,
			TokenNamespace:   cfg.ZanzanaClient.TokenNamespace,
			ServerCertFile:   cfg.ZanzanaClient.ServerCertFile,
			KeepaliveTime:    cfg.ZanzanaClient.KeepaliveTime,
			CallTimeout:      cfg.ZanzanaClient.CallTimeout,
		}
		return NewRemoteZanzanaClient(zanzanaConfig, reg)

	case setting.ZanzanaModeEmbedded:
		channel := &inprocgrpc.Channel{}
		// Put * as a namespace so we can properly authorize request with in-proc mode
		channel.WithServerUnaryInterceptor(grpcAuth.UnaryServerInterceptor(func(ctx context.Context) (context.Context, error) {
			ctx = types.WithAuthInfo(ctx, authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
				Rest: authnlib.AccessTokenClaims{
					Namespace: "*",
					Permissions: []string{
						zanzana.TokenPermissionUpdate,
					},
				},
			}))
			return ctx, nil
		}))

		authzv1.RegisterAuthzServiceServer(channel, zanzanaServer)
		authzextv1.RegisterAuthzExtentionServiceServer(channel, zanzanaServer)

		client, err := zClient.New(channel, reg)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize zanzana client: %w", err)
		}
		return client, nil

	default:
		return nil, fmt.Errorf("unsupported zanzana mode: %s", cfg.ZanzanaClient.Mode)
	}
}

// ProvideEmbeddedZanzanaServer creates and registers embedded ZanzanaServer.
func ProvideEmbeddedZanzanaServer(cfg *setting.Cfg, db db.DB, tracer tracing.Tracer, features featuremgmt.FeatureToggles, reg prometheus.Registerer, restConfig apiserver.RestConfigProvider, storeProvider zStore.StoreProvider, reconcileCRDs []schema.GroupVersionResource, elector leaderelection.Elector) (zanzana.Server, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		return zServer.NewNoopServer(), nil
	}

	logger := log.New("zanzana.server")

	store, err := storeProvider.NewEmbeddedStore(cfg, db, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create zanzana store: %w", err)
	}

	srv, err := zServer.NewEmbeddedZanzanaServer(cfg, store, logger, tracer, reg, restConfig, reconcileCRDs, elector)
	if err != nil {
		return nil, fmt.Errorf("failed to start zanzana: %w", err)
	}

	return srv, nil
}

// ProvideEmbeddedZanzanaElector builds the leader-election Elector for the
// embedded zanzana MT reconciler. The kv.KV is supplied by Wire (sql.ProvideKV
// in OSS, unified.ProvideKV in enterprise) and shared with the unified-storage
// client — Wire memoizes the provider so only one open happens per process.
//
// The CLI Wire graph binds Elector directly to NewDefaultElector, so this
// provider — and therefore sql.ProvideKV — is never invoked from grafana-cli;
// that keeps Badger/SQL out of the CLI startup path.
func ProvideEmbeddedZanzanaElector(cfg *setting.Cfg, features featuremgmt.FeatureToggles, kvStore kv.KV, reg prometheus.Registerer) (leaderelection.Elector, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagZanzana) ||
		cfg.ZanzanaReconciler.Mode != setting.ZanzanaReconcilerModeMT ||
		!cfg.ZanzanaReconciler.LeaderElection.Enabled {
		return leaderelection.NewDefaultElector(), nil
	}

	if kvStore == nil {
		return nil, fmt.Errorf("KV lease leader election requires unified storage KV backend")
	}

	le, err := kvlease.New(kvStore, cfg.ZanzanaReconciler.LeaderElection, log.New("zanzana.mt-reconciler"), reg)
	if err != nil {
		return nil, fmt.Errorf("failed to create KV lease elector: %w", err)
	}
	return le, nil
}

// buildStandaloneZanzanaElector constructs the Kubernetes-Lease elector used by
// the standalone zanzana process. Called lazily from (*Zanzana).start() so that
// InClusterConfig() runs only when the service actually starts inside a pod.
func buildStandaloneZanzanaElector(cfg *setting.Cfg) (leaderelection.Elector, error) {
	if cfg.ZanzanaReconciler.Mode != setting.ZanzanaReconcilerModeMT ||
		!cfg.ZanzanaReconciler.LeaderElection.Enabled {
		return leaderelection.NewDefaultElector(), nil
	}
	restCfg, err := clientrest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get in-cluster config for leader election: %w", err)
	}
	le, err := leaderelection.NewKubernetesElector(restCfg, cfg.ZanzanaReconciler.LeaderElection, log.New("zanzana.mt-reconciler"))
	if err != nil {
		return nil, fmt.Errorf("failed to create leader elector: %w", err)
	}
	return le, nil
}

// ProvideReconcileCRDs returns the OSS list of CRDs. Role and RoleBinding are
// noop-implemented in OSS (pkg/registry/apis/iam/api_installer.go) and are
// omitted — listing them would fail the whole namespace reconcile.
func ProvideReconcileCRDs() []schema.GroupVersionResource {
	return reconciler.DefaultCRDs
}

// ProvideEmbeddedZanzanaService creates a background service wrapper for the embedded zanzana server
// to ensure proper cleanup when Grafana shuts down, and optionally starts the MT reconciler.
func ProvideEmbeddedZanzanaService(
	cfg *setting.Cfg,
	server zanzana.Server,
	tracer tracing.Tracer,
) *EmbeddedZanzanaService {
	return &EmbeddedZanzanaService{
		cfg:    cfg,
		server: server,
		tracer: tracer,
		logger: log.New("zanzana.server"),
	}
}

// EmbeddedZanzanaService wraps the embedded zanzana server as a background service
// to ensure Close() is called during shutdown.
type EmbeddedZanzanaService struct {
	cfg    *setting.Cfg
	server zanzana.Server
	tracer tracing.Tracer
	logger log.Logger
}

func (s *EmbeddedZanzanaService) Run(ctx context.Context) error {
	if s.cfg.ZanzanaReconciler.Mode == setting.ZanzanaReconcilerModeMT {
		srv, ok := s.server.(*zServer.Server)
		if !ok {
			// noop server, reconciler can't run
			<-ctx.Done()
			if s.server != nil {
				s.server.Close()
			}
			return nil
		}

		go func() {
			if err := srv.RunReconciler(ctx); err != nil {
				s.logger.Error("MT reconciler stopped with error", "error", err)
			}
		}()
	}

	// The zanzana server doesn't have a blocking Run method,
	// so we just wait for shutdown
	<-ctx.Done()
	if s.server != nil {
		s.server.Close()
	}
	return nil
}

func (s *EmbeddedZanzanaService) IsDisabled() bool {
	return s.server == nil
}

// ProvideStandaloneZanzanaClient provides a standalone Zanzana client, without registering the Zanzana service.
// Client connects to a remote Zanzana server specified in the configuration.
func ProvideStandaloneZanzanaClient(cfg *setting.Cfg, features featuremgmt.FeatureToggles, reg prometheus.Registerer) (zanzana.Client, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		return zClient.NewNoopClient(), nil
	}

	zanzanaConfig := ZanzanaClientConfig{
		Addr:             cfg.ZanzanaClient.Addr,
		Token:            cfg.ZanzanaClient.Token,
		TokenExchangeURL: cfg.ZanzanaClient.TokenExchangeURL,
		TokenNamespace:   cfg.ZanzanaClient.TokenNamespace,
		ServerCertFile:   cfg.ZanzanaClient.ServerCertFile,
		KeepaliveTime:    cfg.ZanzanaClient.KeepaliveTime,
		CallTimeout:      cfg.ZanzanaClient.CallTimeout,
	}

	return NewRemoteZanzanaClient(zanzanaConfig, reg)
}

type ZanzanaClientConfig struct {
	Addr             string
	Token            string
	TokenExchangeURL string
	TokenNamespace   string
	ServerCertFile   string
	KeepaliveTime    time.Duration
	CallTimeout      time.Duration
}

// unaryDefaultTimeout applies a deadline to calls whose context carries no deadline. It spans
// all retry attempts, so it must comfortably exceed the retry interceptor's total backoff.
func unaryDefaultTimeout(timeout time.Duration) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		if _, hasDeadline := ctx.Deadline(); !hasDeadline {
			var cancel context.CancelFunc
			ctx, cancel = context.WithTimeout(ctx, timeout)
			defer cancel()
		}
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}

// unaryRetryInstrument counts retried attempts, identified by the retry attempt metadata
// the retry interceptor sets on each re-invocation.
func unaryRetryInstrument(metric *prometheus.CounterVec) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		attempt, err := strconv.Atoi(metautils.ExtractOutgoing(ctx).Get(grpc_retry.AttemptMetadataKey))
		if err == nil && attempt > 0 {
			metric.WithLabelValues(method).Inc()
		}
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}

// NewRemoteZanzanaClient creates a new Zanzana client that connects to remote Zanzana server.
func NewRemoteZanzanaClient(cfg ZanzanaClientConfig, reg prometheus.Registerer) (zanzana.Client, error) {
	tokenClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            cfg.Token,
		TokenExchangeURL: cfg.TokenExchangeURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	transportCredentials := insecure.NewCredentials()
	if cfg.ServerCertFile != "" {
		transportCredentials, err = credentials.NewClientTLSFromFile(cfg.ServerCertFile, "")
		if err != nil {
			return nil, fmt.Errorf("failed to initialize TLS certificate: %w", err)
		}
	}

	authzRequestDuration := promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
		Name:                            "authz_zanzana_grpc_client_request_duration_seconds",
		Help:                            "Time spent executing requests to zanzana server.",
		NativeHistogramBucketFactor:     1.1,
		NativeHistogramMaxBucketNumber:  160,
		NativeHistogramMinResetDuration: time.Hour,
	}, []string{"operation", "status_code"})
	authzRequestRetries := promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
		Name: "authz_zanzana_grpc_client_request_retries_total",
		Help: "Total number of retries for requests to zanzana server.",
	}, []string{"operation"})
	unaryInterceptors, streamInterceptors := instrument(authzRequestDuration, middleware.ReportGRPCStatusOption)

	// Retry transient failures so in-flight calls survive server pod restarts (e.g. GOAWAY on shutdown).
	retryOptions := []grpc_retry.CallOption{
		grpc_retry.WithMax(3),
		grpc_retry.WithBackoff(grpc_retry.BackoffExponentialWithJitter(time.Second, 0.5)),
		grpc_retry.WithCodes(codes.ResourceExhausted, codes.Unavailable, codes.Aborted),
	}
	if cfg.CallTimeout > 0 {
		// Cap each attempt at a quarter of the call deadline so all three retries plus
		// backoff fit within it; a hung attempt is cut early and retried instead of one
		// attempt consuming the whole budget.
		retryOptions = append(retryOptions, grpc_retry.WithPerRetryTimeout(cfg.CallTimeout/4))
	}
	retryInterceptor := grpc_retry.UnaryClientInterceptor(retryOptions...)

	// Metrics/tracing outermost so a retried call records one duration entry, then the
	// default deadline spanning all attempts, then retry, then the per-attempt retry counter.
	unaryChain := unaryInterceptors
	if cfg.CallTimeout > 0 {
		// Background callers (reconcilers, hooks) may pass contexts without deadlines; a default
		// deadline prevents calls from blocking indefinitely on an unresponsive connection.
		unaryChain = append(unaryChain, unaryDefaultTimeout(cfg.CallTimeout))
	}
	unaryChain = append(unaryChain, retryInterceptor, unaryRetryInstrument(authzRequestRetries))

	dialOptions := []grpc.DialOption{
		grpc.WithTransportCredentials(transportCredentials),
		grpc.WithPerRPCCredentials(
			NewGRPCTokenAuth(AuthzServiceAudience, cfg.TokenNamespace, tokenClient),
		),
		grpc.WithChainUnaryInterceptor(unaryChain...),
		grpc.WithChainStreamInterceptor(streamInterceptors...),
		grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`),
		// Fast connection backoff for quicker recovery from transient failures (e.g. during pod
		// restarts). Default gRPC backoff waits up to 120s between reconnect attempts.
		grpc.WithConnectParams(grpc.ConnectParams{
			Backoff: backoff.Config{
				BaseDelay:  100 * time.Millisecond,
				Multiplier: 1.6,
				Jitter:     0.2,
				MaxDelay:   10 * time.Second,
			},
			MinConnectTimeout: 5 * time.Second,
		}),
	}

	// Keepalive pings detect silently dead connections (e.g. an unresponsive server pod)
	// that would otherwise block calls until the peer is torn down externally.
	if cfg.KeepaliveTime > 0 {
		dialOptions = append(dialOptions, grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:    cfg.KeepaliveTime,
			Timeout: 10 * time.Second,
		}))
	}

	conn, err := grpc.NewClient(cfg.Addr, dialOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create zanzana client to remote server: %w", err)
	}

	client, err := zClient.New(conn, reg)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize zanzana client: %w", err)
	}

	return client, nil
}

type ZanzanaService interface {
	services.NamedService
}

var _ ZanzanaService = (*Zanzana)(nil)

// ProvideZanzanaService is used to register zanzana as a module so we can run it separately from grafana.
func ProvideZanzanaService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, reg prometheus.Registerer, storeProvider zStore.StoreProvider, reconcileCRDs []schema.GroupVersionResource) (*Zanzana, error) {
	cfgProvider, err := configprovider.ProvideService(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to provide config: %w", err)
	}
	tracingCfg, err := tracing.ProvideTracingConfig(cfgProvider)
	if err != nil {
		return nil, fmt.Errorf("failed to provide tracing config: %w", err)
	}

	tracingCfg.ServiceName = "zanzana"

	tracer, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to provide tracing service: %w", err)
	}

	s := &Zanzana{
		cfg:           cfg,
		logger:        log.New("zanzana.server"),
		reg:           reg,
		tracer:        tracer,
		storeProvider: storeProvider,
		reconcileCRDs: reconcileCRDs,
	}

	s.BasicService = services.NewBasicService(s.start, s.running, s.stopping).WithName("zanzana")

	return s, nil
}

type Zanzana struct {
	*services.BasicService

	cfg           *setting.Cfg
	zanzanaServer zanzana.ServerInternal
	logger        log.Logger
	tracer        tracing.Tracer
	handle        grpcserver.Provider
	reg           prometheus.Registerer
	storeProvider zStore.StoreProvider
	reconcileCRDs []schema.GroupVersionResource
}

func (z *Zanzana) start(ctx context.Context) error {
	store, err := z.storeProvider.NewStandaloneStore(z.cfg, z.logger)
	if err != nil {
		return fmt.Errorf("failed to create zanzana store: %w", err)
	}

	elector, err := buildStandaloneZanzanaElector(z.cfg)
	if err != nil {
		return err
	}

	zanzanaServer, err := zServer.NewZanzanaServer(z.cfg, store, z.logger, z.tracer, z.reg, z.reconcileCRDs, elector)
	if err != nil {
		return fmt.Errorf("failed to start zanzana: %w", err)
	}
	z.zanzanaServer = zanzanaServer

	var authenticatorInterceptor interceptors.Authenticator
	if z.cfg.ZanzanaServer.AllowInsecure && z.cfg.Env == setting.Dev {
		z.logger.Info("Allowing insecure connections to zanzana server")
		authenticatorInterceptor = noopAuthenticator{}
	} else {
		z.logger.Info("Requiring secure connections to zanzana server")
		authenticator := authnlib.NewAccessTokenAuthenticator(
			authnlib.NewAccessTokenVerifier(
				authnlib.VerifierConfig{AllowedAudiences: []string{AuthzServiceAudience}},
				authnlib.NewKeyRetriever(authnlib.KeyRetrieverConfig{
					SigningKeysURL: z.cfg.ZanzanaServer.SigningKeysURL,
				}),
			),
		)
		authenticatorInterceptor = interceptors.AuthenticatorFunc(
			grpcutils.NewAuthenticatorInterceptor(
				authenticator,
				z.tracer,
			),
		)
	}

	z.handle, err = grpcserver.ProvideService(
		z.cfg,
		authenticatorInterceptor,
		z.tracer,
		prometheus.DefaultRegisterer,
	)
	if err != nil {
		return fmt.Errorf("failed to create zanzana grpc server: %w", err)
	}

	grpcServer := z.handle.GetServer()
	authzv1.RegisterAuthzServiceServer(grpcServer, zanzanaServer)
	authzextv1.RegisterAuthzExtentionServiceServer(grpcServer, zanzanaServer)

	// register grpc health server
	healthServer := zServer.NewHealthServer(zanzanaServer)
	healthv1pb.RegisterHealthServer(grpcServer, healthServer)

	if z.cfg.ZanzanaServer.OpenFGAHttpAddr != "" {
		// Register OpenFGA service server to pass to the HTTP server
		openfgav1.RegisterOpenFGAServiceServer(grpcServer, zanzanaServer.GetOpenFGAServer())
	}

	if _, err := grpcserver.ProvideReflectionService(z.cfg, z.handle); err != nil {
		return fmt.Errorf("failed to register reflection for zanzana: %w", err)
	}

	return nil
}

func (z *Zanzana) running(ctx context.Context) error {
	if z.cfg.ZanzanaServer.OpenFGAHttpAddr != "" {
		go func() {
			if err := z.runHTTPServer(); err != nil {
				z.logger.Error("failed to run OpenFGA HTTP server", "error", err)
			}
		}()
	}

	if z.cfg.ZanzanaReconciler.Mode == setting.ZanzanaReconcilerModeMT {
		go func() {
			if err := z.zanzanaServer.RunReconciler(ctx); err != nil {
				z.logger.Error("reconciler stopped with error", "error", err)
			}
		}()
	}

	// Run is blocking so we can just run it here
	return z.handle.Run(ctx)
}

func (z *Zanzana) stopping(err error) error {
	if err != nil && !errors.Is(err, context.Canceled) {
		z.logger.Error("Stopping zanzana due to unexpected error", "err", err)
	}
	z.zanzanaServer.Close()
	return nil
}

func (z *Zanzana) runHTTPServer() error {
	if z.cfg.Env != setting.Dev && z.cfg.ZanzanaServer.AllowInsecure {
		return fmt.Errorf("allow_insecure is only supported in dev mode")
	}

	z.logger.Info("Initializing OpenFGA HTTP server", "address", z.cfg.ZanzanaServer.OpenFGAHttpAddr)

	httpSrv, err := zServer.NewOpenFGAHttpServer(z.cfg.ZanzanaServer, z.handle)
	if err != nil {
		z.logger.Error("failed to create OpenFGA HTTP server", "error", err)
		return err
	} else {
		z.logger.Info("Starting OpenFGA HTTP server", "address", z.cfg.ZanzanaServer.OpenFGAHttpAddr)
		if z.cfg.ZanzanaServer.AllowInsecure {
			z.logger.Warn("Allowing unauthenticated connections!")
		}
		if err := httpSrv.ListenAndServe(); err != nil {
			z.logger.Error("failed to start OpenFGA HTTP server", "error", err)
			return err
		}
	}

	return nil
}

// TODO this impl might be more broadly useful in authlib
type noopAuthenticator struct {
}

func (n noopAuthenticator) Authenticate(ctx context.Context) (context.Context, error) {
	return ctx, nil
}
