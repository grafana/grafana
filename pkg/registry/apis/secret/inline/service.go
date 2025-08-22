package inline

import (
	"fmt"

	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideInlineSecureValueService(
	cfg *setting.Cfg,
	tracer trace.Tracer,
	secureValueService contracts.SecureValueService,
	accessClient authlib.AccessClient,
) (contracts.InlineSecureValueSupport, error) {
	if cfg.SecretsManagement.GrpcClientEnable {
		return NewGRPCSecureValueService(
			grpcutils.ReadGrpcClientConfig(cfg),
			cfg.SecretsManagement.GrpcServerAddress,
			readTLSFromConfig(cfg),
			tracer,
		)
	}

	return NewLocalInlineSecureValueService(tracer, secureValueService, accessClient), nil
}

func NewGRPCSecureValueService(tokenCfg *grpcutils.GrpcClientConfig,
	address string,
	tlsCfg TLSConfig,
	tracer trace.Tracer,
) (contracts.InlineSecureValueSupport, error) {

	if address == "" {
		return nil, fmt.Errorf("grpc_server_address is required when grpc client is enabled")
	}

	if tokenCfg.Token == "" || tokenCfg.TokenExchangeURL == "" {
		return nil, fmt.Errorf("grpc_client_authentication.token and grpc_client_authentication.token_exchange_url are required when grpc client is enabled")
	}

	tokenExchangeClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            tokenCfg.Token,
		TokenExchangeURL: tokenCfg.TokenExchangeURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	client, err := NewGRPCInlineClient(tokenExchangeClient, tracer, address, tlsCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create grpc inline secure value client: %w", err)
	}

	return client, nil
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
