package decrypt

import (
	"context"
	"errors"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	authnlib "github.com/grafana/authlib/authn"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
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
) (service.DecryptService, error) {
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

	return NewDecryptService(cfg, existingDecryptStorage)
}

type DecryptService struct {
	cfg                    *setting.Cfg
	logger                 log.Logger
	existingDecryptStorage contracts.DecryptStorage
	grpcClient             *GRPCDecryptClient
	grpcClientConfig       *grpcutils.GrpcClientConfig
	tokenExchangeClient    authnlib.TokenExchanger
}

var _ service.DecryptService = &DecryptService{}

func NewDecryptService(cfg *setting.Cfg, existingDecryptStorage contracts.DecryptStorage) (*DecryptService, error) {
	storage := &DecryptService{
		cfg:                    cfg,
		logger:                 log.New("secrets.decrypt.conditional"),
		existingDecryptStorage: existingDecryptStorage,
		grpcClientConfig:       grpcutils.ReadGrpcClientConfig(cfg),
	}

	if cfg.SecretsManagement.DecryptServerType == "grpc" {
		if cfg.SecretsManagement.DecryptServerAddress == "" {
			return nil, fmt.Errorf("decrypt_server_address is required when decrypt_server_type is grpc")
		}

		if storage.grpcClientConfig.Token == "" || storage.grpcClientConfig.TokenExchangeURL == "" {
			return nil, fmt.Errorf("grpc_client_authentication.token and grpc_client_authentication.token_exchange_url are required when secrets_manager.decrypt_server_type is grpc")
		}

		tokenExchangeClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			Token:            storage.grpcClientConfig.Token,
			TokenExchangeURL: storage.grpcClientConfig.TokenExchangeURL,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create token exchange client: %w", err)
		}
		storage.tokenExchangeClient = tokenExchangeClient

		// TODO: allow configuration of TLS settings
		tlsConfig := &TLSConfig{
			UseTLS:             true,
			InsecureSkipVerify: true,
		}

		grpcClient, err := NewGRPCDecryptClientWithTLS(cfg.SecretsManagement.DecryptServerAddress, storage.logger, tlsConfig)

		if err != nil {
			return nil, fmt.Errorf("failed to create grpc decrypt client: %w", err)
		}
		storage.grpcClient = grpcClient
	}

	return storage, nil
}

func (c *DecryptService) Decrypt(ctx context.Context, namespace string, names ...string) (map[string]service.DecryptResult, error) {
	switch c.cfg.SecretsManagement.DecryptServerType {
	case "grpc":
		return c.decryptViaGRPC(ctx, namespace, names...)
	case "local", "":
		return c.decryptViaLocal(ctx, namespace, names...)
	default:
		return nil, fmt.Errorf("unsupported storage type: %s", c.cfg.SecretsManagement.DecryptServerType)
	}
}

func (c *DecryptService) decryptViaGRPC(ctx context.Context, namespace string, names ...string) (map[string]service.DecryptResult, error) {
	accessToken, err := c.getAccessToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get access token: %w", err)
	}

	values, err := c.grpcClient.DecryptSecureValues(ctx, namespace, names, accessToken)
	if err != nil {
		return nil, fmt.Errorf("grpc decrypt failed: %w", err)
	}

	results := make(map[string]service.DecryptResult, len(names))
	for _, name := range names {
		value, exists := values[name]
		switch {
		case !exists:
			results[name] = service.NewDecryptResultErr(contracts.ErrDecryptNotFound)
		case value.GetErrorMessage() != "":
			results[name] = service.NewDecryptResultErr(errors.New(value.GetErrorMessage()))
		default:
			exposedValue := secretv1beta1.ExposedSecureValue(value.GetValue())
			results[name] = service.NewDecryptResultValue(&exposedValue)
		}
	}

	return results, nil
}

func (c *DecryptService) decryptViaLocal(ctx context.Context, namespace string, names ...string) (map[string]service.DecryptResult, error) {
	results := make(map[string]service.DecryptResult, len(names))

	for _, name := range names {
		exposedSecureValue, err := c.existingDecryptStorage.Decrypt(ctx, xkube.Namespace(namespace), name)
		if err != nil {
			results[name] = service.NewDecryptResultErr(err)
		} else {
			results[name] = service.NewDecryptResultValue(&exposedSecureValue)
		}
	}

	return results, nil
}

func (c *DecryptService) getAccessToken(ctx context.Context) (string, error) {
	token, err := c.tokenExchangeClient.Exchange(ctx, authnlib.TokenExchangeRequest{
		Namespace: c.grpcClientConfig.TokenNamespace,
		Audiences: []string{secretv1beta1.APIGroup},
	})
	if err != nil {
		return "", fmt.Errorf("failed to exchange token: %w", err)
	}

	return token.Token, nil
}

func (c *DecryptService) Close() error {
	var errs []error

	if c.grpcClient != nil {
		if err := c.grpcClient.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close grpc client: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors closing decrypt service: %v", errs)
	}
	return nil
}
