package authz

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"k8s.io/client-go/rest"

	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/cache"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// AuthzServiceAudience is the audience for the authz service.
const AuthzServiceAudience = "authzService"

// ProvideAuthZClient provides an AuthZ client and creates the AuthZ service.
func ProvideAuthZClient(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	grpcServer grpcserver.Provider,
	tracer tracing.Tracer,
	reg prometheus.Registerer,
	db db.DB,
	acService accesscontrol.Service,
	zanzanaClient zanzana.Client,
	restConfig apiserver.RestConfigProvider,
) (authlib.AccessClient, error) {
	authCfg, err := readAuthzClientSettings(cfg)
	if err != nil {
		return nil, err
	}

	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) && authCfg.mode == clientModeCloud {
		return nil, errors.New("authZGRPCServer feature toggle is required for cloud and grpc mode")
	}

	// Provisioning uses mode 4 (read+write only to unified storage)
	// For G12 launch, we can disable caching for this and find a more scalable solution soon
	// most likely this would involve passing the RV (timestamp!) in each check method
	if features.IsEnabledGlobally(featuremgmt.FlagProvisioning) {
		authCfg.cacheTTL = 0
	}

	switch authCfg.mode {
	case clientModeCloud:
		rbacClient, err := newRemoteRBACClient(authCfg, tracer)
		if features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
			return zanzana.WithShadowClient(rbacClient, zanzanaClient, reg)
		}
		return rbacClient, err
	default:
		sql := legacysql.NewDatabaseProvider(db)

		rbacSettings := rbac.Settings{CacheTTL: authCfg.cacheTTL}
		if cfg != nil {
			rbacSettings.AnonOrgRole = cfg.Anonymous.OrgRole
		}

		// Register the server
		server := rbac.NewService(
			sql,
			// When running in-proc we get a injection cycle between
			// authz client, resource client and apiserver so we need to use
			// package level function to get rest config
			store.NewAPIFolderStore(tracer, restConfig.GetRestConfig),
			legacy.NewLegacySQLStores(sql),
			store.NewUnionPermissionStore(
				store.NewStaticPermissionStore(acService),
				store.NewSQLPermissionStore(sql, tracer),
			),
			log.New("authz-grpc-server"),
			tracer,
			reg,
			cache.NewLocalCache(cache.Config{Expiry: 5 * time.Minute, CleanupInterval: 10 * time.Minute}),
			rbacSettings,
		)

		channel := &inprocgrpc.Channel{}
		channel.WithServerUnaryInterceptor(grpcAuth.UnaryServerInterceptor(func(ctx context.Context) (context.Context, error) {
			ctx = authlib.WithAuthInfo(ctx, authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
				Rest: authnlib.AccessTokenClaims{
					Namespace: "*",
				},
			}))
			return ctx, nil
		}))
		authzv1.RegisterAuthzServiceServer(channel, server)
		rbacClient := authzlib.NewClient(
			channel,
			authzlib.WithCacheClientOption(&NoopCache{}),
			authzlib.WithTracerClientOption(tracer),
		)

		if features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
			return zanzana.WithShadowClient(rbacClient, zanzanaClient, reg)
		}

		return rbacClient, nil
	}
}

// ProvideStandaloneAuthZClient provides a standalone AuthZ client, without registering the AuthZ service.
// You need to provide a remote address in the configuration
func ProvideStandaloneAuthZClient(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer trace.Tracer,
) (authlib.AccessClient, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	authCfg, err := readAuthzClientSettings(cfg)
	if err != nil {
		return nil, err
	}

	return newRemoteRBACClient(authCfg, tracer)
}

func newRemoteRBACClient(clientCfg *authzClientSettings, tracer trace.Tracer) (authlib.AccessClient, error) {
	tokenClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            clientCfg.token,
		TokenExchangeURL: clientCfg.tokenExchangeURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize token exchange client: %w", err)
	}

	transportCreds := insecure.NewCredentials()
	if clientCfg.certFile != "" {
		transportCreds, err = credentials.NewClientTLSFromFile(clientCfg.certFile, "")
		if err != nil {
			return nil, fmt.Errorf("failed to load TLS credentials: %w", err)
		}
	}

	conn, err := grpc.NewClient(
		clientCfg.remoteAddress,
		grpc.WithTransportCredentials(transportCreds),
		grpc.WithPerRPCCredentials(
			NewGRPCTokenAuth(AuthzServiceAudience, clientCfg.tokenNamespace, tokenClient),
		),
		// Add client-side load balancing
		grpc.WithDefaultServiceConfig(`{
              "loadBalancingPolicy": "round_robin",
              "healthCheckConfig": {
                  "serviceName": ""
              }
          }`),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                10 * time.Second,
			Timeout:             3 * time.Second,
			PermitWithoutStream: true,
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create authz client to remote server: %w", err)
	}

	// Client side cache
	var authzCache cache.Cache = &NoopCache{}
	if clientCfg.cacheTTL != 0 {
		authzCache = cache.NewLocalCache(cache.Config{
			Expiry:          clientCfg.cacheTTL,
			CleanupInterval: 2 * time.Minute,
		})
	}

	client := authzlib.NewClient(conn, authzlib.WithCacheClientOption(authzCache), authzlib.WithTracerClientOption(tracer))

	return client, nil
}

func RegisterRBACAuthZService(
	handler grpcserver.Provider,
	db legacysql.LegacyDatabaseProvider,
	tracer tracing.Tracer,
	reg prometheus.Registerer,
	cache cache.Cache,
	exchangeClient authnlib.TokenExchanger,
	cfg RBACServerSettings,
) {
	var folderStore store.FolderStore
	// FIXME: for now we default to using database read proxy for folders if the api url is not configured.
	// we should remove this and the sql implementation once we have verified that is works correctly
	if cfg.Folder.Host == "" {
		folderStore = store.NewSQLFolderStore(db, tracer)
	} else {
		folderStore = store.NewAPIFolderStore(tracer, func(ctx context.Context) (*rest.Config, error) {
			return &rest.Config{
				Host: cfg.Folder.Host,
				WrapTransport: func(rt http.RoundTripper) http.RoundTripper {
					return &tokenExhangeRoundTripper{te: exchangeClient, rt: rt}
				},
				TLSClientConfig: rest.TLSClientConfig{
					Insecure: cfg.Folder.Insecure,
					CAFile:   cfg.Folder.CAFile,
				},
				QPS:   50,
				Burst: 100,
			}, nil
		})
	}

	server := rbac.NewService(
		db,
		folderStore,
		legacy.NewLegacySQLStores(db),
		store.NewSQLPermissionStore(db, tracer),
		log.New("authz-grpc-server"),
		tracer,
		reg,
		cache,
		rbac.Settings{CacheTTL: cfg.CacheTTL}, // anonymous org role can only be set in-proc
	)

	srv := handler.GetServer()
	authzv1.RegisterAuthzServiceServer(srv, server)
}

var _ http.RoundTripper = tokenExhangeRoundTripper{}

type tokenExhangeRoundTripper struct {
	te authnlib.TokenExchanger
	rt http.RoundTripper
}

func (t tokenExhangeRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) {
	res, err := t.te.Exchange(r.Context(), authnlib.TokenExchangeRequest{
		Namespace: "*",
		Audiences: []string{"folder.grafana.app"},
	})
	if err != nil {
		return nil, fmt.Errorf("create access token: %w", err)
	}

	r.Header.Set("X-Access-Token", "Bearer "+res.Token)
	return t.rt.RoundTrip(r)
}

type NoopCache struct{}

func (lc *NoopCache) Get(ctx context.Context, key string) ([]byte, error) {
	return nil, cache.ErrNotFound
}

func (lc *NoopCache) Set(ctx context.Context, key string, data []byte, exp time.Duration) error {
	return nil
}

func (lc *NoopCache) Delete(ctx context.Context, key string) error {
	return nil
}
