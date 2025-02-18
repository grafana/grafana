package grpcutils

import (
	"github.com/spf13/pflag"

	"github.com/grafana/grafana/pkg/setting"
)

type GrpcServerConfig struct {
	SigningKeysURL   string
	AllowedAudiences []string
	LegacyFallback   bool
	AllowInsecure    bool
}

func (c *GrpcServerConfig) AddFlags(fs *pflag.FlagSet) {
	fs.StringVar(&c.SigningKeysURL, "grpc-server-authentication.signing-keys-url", "", "gRPC server authentication signing keys URL")
}

func ReadGrpcServerConfig(cfg *setting.Cfg) *GrpcServerConfig {
	section := cfg.SectionWithEnvOverrides("grpc_server_authentication")

	return &GrpcServerConfig{
		SigningKeysURL:   section.Key("signing_keys_url").MustString(""),
		AllowedAudiences: section.Key("allowed_audiences").Strings(","),
		LegacyFallback:   section.Key("legacy_fallback").MustBool(true),
		AllowInsecure:    cfg.Env == setting.Dev,
	}
}

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
		TokenNamespace:   section.Key("token_namespace").MustString("stacks-" + cfg.StackID),
	}
}
