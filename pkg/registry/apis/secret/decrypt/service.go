package decrypt

import (
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/metadata"
)

func ProvideDecryptService(
	cfg *setting.Cfg,
	tracer trace.Tracer,
	keeperService contracts.KeeperService,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	decryptAuthorizer contracts.DecryptAuthorizer,
	reg prometheus.Registerer,
) (contracts.DecryptService, error) {
	existingDecryptStorage, err := metadata.ProvideDecryptStorage(
		tracer,
		keeperService,
		keeperMetadataStorage,
		secureValueMetadataStorage,
		decryptAuthorizer,
		reg,
	)
	if err != nil {
		return nil, err
	}

	return NewDecryptService(cfg, tracer, existingDecryptStorage)
}

func NewDecryptService(cfg *setting.Cfg, tracer trace.Tracer, decryptStorage contracts.DecryptStorage) (contracts.DecryptService, error) {
	switch cfg.SecretsManagement.DecryptServerType {
	case "grpc":
		grpcClientConfig := grpcutils.ReadGrpcClientConfig(cfg)

		if cfg.SecretsManagement.DecryptServerAddress == "" {
			return nil, fmt.Errorf("decrypt_server_address is required when decrypt_server_type is grpc")
		}

		if grpcClientConfig.Token == "" || grpcClientConfig.TokenExchangeURL == "" {
			return nil, fmt.Errorf("grpc_client_authentication.token and grpc_client_authentication.token_exchange_url are required when secrets_manager.decrypt_server_type is grpc")
		}

		tokenExchangeClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			Token:            grpcClientConfig.Token,
			TokenExchangeURL: grpcClientConfig.TokenExchangeURL,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create token exchange client: %w", err)
		}

		// TODO: allow configuration of TLS settings
		tlsConfig := TLSConfig{
			UseTLS:             true,
			InsecureSkipVerify: true,
		}

		// TODO: service name
		client, err := NewGRPCDecryptClientWithTLS(tokenExchangeClient, tracer, cfg.SecretsManagement.DecryptServerAddress, tlsConfig, "service-name")
		if err != nil {
			return nil, fmt.Errorf("failed to create grpc decrypt client: %w", err)
		}

		return client, nil

	case "local", "":
		return NewLocalDecryptClient(decryptStorage)
	}

	return nil, fmt.Errorf("unsupported storage type: %s", cfg.SecretsManagement.DecryptServerType)
}
