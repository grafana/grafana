package grpcutils

import (
	"github.com/grafana/grafana/pkg/setting"
)

type GrpcClientConfig struct {
	Token            string
	TokenExchangeURL string
	TokenNamespace   string
}

func ReadGrpcClientConfig(cfg *setting.Cfg) *GrpcClientConfig {
	section := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	return &GrpcClientConfig{
		Token:            section.Key("token").MustString(""),
		TokenExchangeURL: section.Key("token_exchange_url").MustString(""),
		TokenNamespace:   section.Key("token_namespace").MustString("stack-" + cfg.StackID),
	}
}

type GrpcServerConfig struct {
	SigningKeysURL   string
	AllowedAudiences []string
}

func ReadGprcServerConfig(cfg *setting.Cfg) *GrpcServerConfig {
	section := cfg.SectionWithEnvOverrides("grpc_server_authentication")

	return &GrpcServerConfig{
		SigningKeysURL:   section.Key("signing_keys_url").MustString(""),
		AllowedAudiences: section.Key("allowed_audiences").Strings(","),
	}
}
