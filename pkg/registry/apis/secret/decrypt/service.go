package decrypt

import (
	"fmt"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideDecryptService(cfg *setting.Cfg, tracer trace.Tracer, decryptStorage contracts.DecryptStorage) (contracts.DecryptService, error) {
	switch cfg.SecretsManagement.DecryptServerType {
	case "grpc":
		grpcClientConfig := grpcutils.ReadGrpcClientConfig(cfg)

		if cfg.SecretsManagement.DecryptServerAddress == "" {
			return nil, fmt.Errorf("decrypt_server_address is required when decrypt_server_type is grpc")
		}

		if grpcClientConfig.Token == "" || grpcClientConfig.TokenExchangeURL == "" {
			return nil, fmt.Errorf("grpc_client_authentication.token and grpc_client_authentication.token_exchange_url are required when secrets_manager.decrypt_server_type is grpc")
		}

		nsInfo, err := claims.ParseNamespace(grpcClientConfig.TokenNamespace)
		if err != nil {
			return nil, fmt.Errorf("failed to parse token namespace %v: %w", grpcClientConfig.TokenNamespace, err)
		}
		if nsInfo.OrgID < 1 {
			return nil, fmt.Errorf("invalid token namepsace %v", grpcClientConfig.TokenNamespace)
		}

		tokenExchangeClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			Token:            grpcClientConfig.Token,
			TokenExchangeURL: grpcClientConfig.TokenExchangeURL,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create token exchange client: %w", err)
		}

		tlsConfig := readTLSFromConfig(cfg)

		client, err := NewGRPCDecryptClientWithTLS(tokenExchangeClient, tracer, cfg.SecretsManagement.DecryptServerAddress, tlsConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to create grpc decrypt client: %w", err)
		}

		return client, nil

	case "local", "":
		return NewLocalDecryptClient(decryptStorage)
	}

	return nil, fmt.Errorf("unsupported storage type: %s", cfg.SecretsManagement.DecryptServerType)
}

func readTLSFromConfig(cfg *setting.Cfg) TLSConfig {
	if !cfg.SecretsManagement.DecryptServerUseTLS {
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
		ServerName:         cfg.SecretsManagement.DecryptServerTLSServerName,
		InsecureSkipVerify: cfg.SecretsManagement.DecryptServerTLSSkipVerify,
	}
}
