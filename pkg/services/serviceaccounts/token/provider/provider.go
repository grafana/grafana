// Package provider selects which service account token store backend to use.
package provider

import (
	"fmt"

	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccounttoken/tokenstoreserver"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/token/grpcstore"
	"github.com/grafana/grafana/pkg/setting"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
)

// ProvideStorage returns the token store selected by [service_accounts] token_store_type.
func ProvideStorage(cfg *setting.Cfg, embedded satoken.EmbeddedStorage, tracer trace.Tracer) (satoken.Storage, error) {
	switch satoken.StoreType(cfg.SATokenStoreType) {
	case satoken.StoreTypeMT:
		return provideMTStorage(cfg, embedded, tracer)
	case satoken.StoreTypeEmbedded, "":
		return embedded, nil
	default:
		// Fail loudly: a typo must not silently land tokens in the wrong backend.
		return nil, fmt.Errorf("unknown service account token store type %q", cfg.SATokenStoreType)
	}
}

func provideMTStorage(cfg *setting.Cfg, embedded satoken.EmbeddedStorage, tracer trace.Tracer) (satoken.Storage, error) {
	if cfg.SATokenStoreGrpcAddress == "" {
		// In-process server over the local serviceaccount_token table: no ports or
		// TLS needed, but writes still persist and calls are still authenticated.
		exchanger, err := tokenstoreserver.NewInProcTokenExchanger()
		if err != nil {
			return nil, fmt.Errorf("creating in-process token exchanger: %w", err)
		}

		return grpcstore.New(tokenstoreserver.NewInProcChannel(embedded, tracer), exchanger, tracer), nil
	}

	grpcClientConfig := grpcutils.ReadGrpcClientConfig(cfg)
	if grpcClientConfig.Token == "" || grpcClientConfig.TokenExchangeURL == "" {
		return nil, fmt.Errorf("grpc_client_authentication.token and grpc_client_authentication.token_exchange_url are required when token_store_grpc_address is set")
	}

	tokenExchangeClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            grpcClientConfig.Token,
		TokenExchangeURL: grpcClientConfig.TokenExchangeURL,
	})
	if err != nil {
		return nil, fmt.Errorf("creating token exchange client: %w", err)
	}

	conn, err := grpc.NewClient(cfg.SATokenStoreGrpcAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("connecting to token store at %s: %w", cfg.SATokenStoreGrpcAddress, err)
	}

	return grpcstore.New(conn, tokenExchangeClient, tracer), nil
}
