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
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
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
) (authlib.AccessClient, error) {
	authCfg, err := readAuthzClientSettings(cfg)
	if err != nil {
		return nil, err
	}

	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) && authCfg.mode == clientModeCloud {
		return nil, errors.New("authZGRPCServer feature toggle is required for cloud and grpc mode")
	}

	switch authCfg.mode {
	case clientModeCloud:
		return newRemoteRBACClient(authCfg, tracer)
	default:
		sql := legacysql.NewDatabaseProvider(db)

		// Register the server
		server := rbac.NewService(
			sql,
			// When running in-proc we get a injection cycle between
			// authz client, resource client and apiserver so we need to use
			// package level function to get rest config
			store.NewAPIFolderStore(tracer, apiserver.GetRestConfig),
			legacy.NewLegacySQLStores(sql),
			store.NewUnionPermissionStore(
				store.NewStaticPermissionStore(acService),
				store.NewSQLPermissionStore(sql, tracer),
			),
			log.New("authz-grpc-server"),
			tracer,
			reg,
			cache.NewLocalCache(cache.Config{Expiry: 5 * time.Minute, CleanupInterval: 10 * time.Minute}),
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
		return newRBACClient(channel, tracer), nil
	}
}

// ProvideStandaloneAuthZClient provides a standalone AuthZ client, without registering the AuthZ service.
// You need to provide a remote address in the configuration
func ProvideStandaloneAuthZClient(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer,
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

func newRemoteRBACClient(clientCfg *authzClientSettings, tracer tracing.Tracer) (authlib.AccessClient, error) {
	tokenClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            clientCfg.token,
		TokenExchangeURL: clientCfg.tokenExchangeURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize token exchange client: %w", err)
	}

	conn, err := grpc.NewClient(
		clientCfg.remoteAddress,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithPerRPCCredentials(
			NewGRPCTokenAuth(AuthzServiceAudience, clientCfg.tokenNamespace, tokenClient),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create authz client to remote server: %w", err)
	}

	return newRBACClient(conn, tracer), nil
}

func newRBACClient(conn grpc.ClientConnInterface, tracer tracing.Tracer) authlib.AccessClient {
	return authzlib.NewClient(
		conn,
		authzlib.WithCacheClientOption(cache.NewLocalCache(cache.Config{
			Expiry:          30 * time.Second,
			CleanupInterval: 2 * time.Minute,
		})),
		authzlib.WithTracerClientOption(tracer),
	)
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
