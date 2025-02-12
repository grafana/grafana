package authz

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/fullstorydev/grpchan"
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
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// `authzService` is hardcoded in authz-service
const authzServiceAudience = "authzService"

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
	authCfg, err := ReadCfg(cfg)
	if err != nil {
		return nil, err
	}

	isRemoteServer := authCfg.mode == ModeCloud || authCfg.mode == ModeGRPC
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) && isRemoteServer {
		return nil, errors.New("authZGRPCServer feature toggle is required for cloud and grpc mode")
	}

	switch authCfg.mode {
	case ModeGRPC:
		return newGrpcLegacyClient(authCfg, tracer)
	case ModeCloud:
		return newCloudLegacyClient(authCfg, tracer)
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
		return newInProcLegacyClient(server, tracer)
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

	authCfg, err := ReadCfg(cfg)
	if err != nil {
		return nil, err
	}

	if authCfg.mode == ModeGRPC {
		return newGrpcLegacyClient(authCfg, tracer)
	}
	return newCloudLegacyClient(authCfg, tracer)
}

func newInProcLegacyClient(server *rbac.Service, tracer tracing.Tracer) (authlib.AccessClient, error) {
	// For in-proc use-case authorize add fake service claims - it should be able to access every namespace, as there is only one
	staticAuth := func(ctx context.Context) (context.Context, error) {
		ctx = authlib.WithAuthInfo(ctx, authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{
				Namespace: "*",
			},
		}))
		return ctx, nil
	}

	channel := &inprocgrpc.Channel{}
	channel.RegisterService(
		grpchan.InterceptServer(
			&authzv1.AuthzService_ServiceDesc,
			grpcAuth.UnaryServerInterceptor(staticAuth),
			grpcAuth.StreamServerInterceptor(staticAuth),
		),
		server,
	)

	return authzlib.NewClient(
		&authzlib.ClientConfig{},
		authzlib.WithGrpcConnectionClientOption(channel),
		authzlib.WithDisableAccessTokenClientOption(),
		authzlib.WithTracerClientOption(tracer),
		authzlib.WithCacheClientOption(cache.NewLocalCache(cache.Config{
			Expiry:          30 * time.Second,
			CleanupInterval: 2 * time.Minute,
		})),
	)
}

func newGrpcLegacyClient(authCfg *Cfg, tracer tracing.Tracer) (authlib.AccessClient, error) {
	// This client interceptor is a noop, as we don't send an access token
	clientConfig := authnlib.GrpcClientConfig{}
	clientInterceptor, err := authnlib.NewGrpcClientInterceptor(
		&clientConfig,
		authnlib.WithDisableAccessTokenOption(),
		authnlib.WithTracerOption(tracer),
	)
	if err != nil {
		return nil, err
	}

	cfg := authzlib.ClientConfig{RemoteAddress: authCfg.remoteAddress}
	client, err := authzlib.NewClient(&cfg,
		authzlib.WithGrpcDialOptionsClientOption(
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithUnaryInterceptor(clientInterceptor.UnaryClientInterceptor),
			grpc.WithStreamInterceptor(clientInterceptor.StreamClientInterceptor),
		),
		authzlib.WithTracerClientOption(tracer),
		authzlib.WithCacheClientOption(cache.NewLocalCache(cache.Config{
			Expiry:          30 * time.Second,
			CleanupInterval: 2 * time.Minute,
		})),
		// TODO: remove this once access tokens are supported on-prem
		authzlib.WithDisableAccessTokenClientOption(),
	)
	if err != nil {
		return nil, err
	}

	return client, nil
}

func newCloudLegacyClient(authCfg *Cfg, tracer tracing.Tracer) (authlib.AccessClient, error) {
	grpcClientConfig := authnlib.GrpcClientConfig{
		TokenClientConfig: &authnlib.TokenExchangeConfig{
			Token:            authCfg.token,
			TokenExchangeURL: authCfg.tokenExchangeURL,
		},
		TokenRequest: &authnlib.TokenExchangeRequest{
			Namespace: authCfg.tokenNamespace,
			Audiences: []string{authzServiceAudience},
		},
	}

	clientInterceptor, err := authnlib.NewGrpcClientInterceptor(&grpcClientConfig, authnlib.WithTracerOption(tracer))
	if err != nil {
		return nil, err
	}

	clientCfg := authzlib.ClientConfig{RemoteAddress: authCfg.remoteAddress}
	client, err := authzlib.NewClient(&clientCfg,
		authzlib.WithGrpcDialOptionsClientOption(
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithUnaryInterceptor(clientInterceptor.UnaryClientInterceptor),
			grpc.WithStreamInterceptor(clientInterceptor.StreamClientInterceptor),
		),
		authzlib.WithCacheClientOption(cache.NewLocalCache(cache.Config{
			Expiry:          30 * time.Second,
			CleanupInterval: 2 * time.Minute,
		})),
		authzlib.WithTracerClientOption(tracer),
	)
	if err != nil {
		return nil, err
	}

	return client, nil
}

func RegisterRBACAuthZService(
	handler grpcserver.Provider,
	db legacysql.LegacyDatabaseProvider,
	tracer tracing.Tracer,
	reg prometheus.Registerer,
	cache cache.Cache,
	exchangeClient authnlib.TokenExchanger,
	folderAPIURL string,
) {
	var folderStore store.FolderStore
	// FIXME: for now we default to using database read proxy for folders if the api url is not configured.
	// we should remove this and the sql implementation once we have verified that is works correctly
	if folderAPIURL == "" {
		folderStore = store.NewSQLFolderStore(db, tracer)
	} else {
		folderStore = store.NewAPIFolderStore(tracer, func(ctx context.Context) *rest.Config {
			return &rest.Config{
				Host: folderAPIURL,
				WrapTransport: func(rt http.RoundTripper) http.RoundTripper {
					return &tokenExhangeRoundTripper{te: exchangeClient, rt: rt}
				},
				QPS:   50,
				Burst: 100,
			}
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
	authzextv1.RegisterAuthzExtentionServiceServer(srv, server)
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
