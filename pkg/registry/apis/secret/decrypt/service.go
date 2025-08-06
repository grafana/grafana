package decrypt

import (
	"fmt"

	authnlib "github.com/grafana/authlib/authn"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideDecryptService(cfg *setting.Cfg, tracer trace.Tracer, decryptStorage contracts.DecryptStorage) (contracts.DecryptService, error) {
	if cfg.SecretsManagement.GrpcClientEnable {
		grpcClientConfig := grpcutils.ReadGrpcClientConfig(cfg)

		if cfg.SecretsManagement.GrpcServerAddress == "" {
			return nil, fmt.Errorf("grpc_server_address is required when grpc client is enabled")
		}

		if grpcClientConfig.Token == "" || grpcClientConfig.TokenExchangeURL == "" {
			return nil, fmt.Errorf("grpc_client_authentication.token and grpc_client_authentication.token_exchange_url are required when grpc client is enabled")
		}

		tokenExchangeClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			Token:            grpcClientConfig.Token,
			TokenExchangeURL: grpcClientConfig.TokenExchangeURL,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create token exchange client: %w", err)
		}

		tlsConfig := readTLSFromConfig(cfg)

		client, err := NewGRPCDecryptClientWithTLS(tokenExchangeClient, tracer, cfg.SecretsManagement.GrpcServerAddress, tlsConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to create grpc decrypt client: %w", err)
		}

		return client, nil
	}

	return NewLocalDecryptClient(decryptStorage)
}

func readTLSFromConfig(cfg *setting.Cfg) TLSConfig {
	if !cfg.SecretsManagement.GrpcServerUseTLS {
		return TLSConfig{
			UseTLS:             false,
			InsecureSkipVerify: true,
		}
	}

	apiServer := cfg.SectionWithEnvOverrides("grafana-apiserver")

	return TLSConfig{
		UseTLS:             true,
		CertFile:           apiServer.Key("proxy_client_cert_file").MustString(""),
		KeyFile:            apiServer.Key("proxy_client_key_file").MustString(""),
		CAFile:             apiServer.Key("apiservice_ca_bundle_file").MustString(""),
		ServerName:         cfg.SecretsManagement.GrpcServerTLSServerName,
		InsecureSkipVerify: cfg.SecretsManagement.GrpcServerTLSSkipVerify,
	}
}
