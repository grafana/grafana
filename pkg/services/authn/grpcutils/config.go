package grpcutils

import (
	"fmt"

	"github.com/spf13/pflag"

	"github.com/grafana/grafana/pkg/setting"
)

type Mode string

func (s Mode) IsValid() bool {
	switch s {
	case ModeOnPrem, ModeCloud:
		return true
	}
	return false
}

const (
	ModeOnPrem Mode = "on-prem"
	ModeCloud  Mode = "cloud"
)

type GrpcServerConfig struct {
	SigningKeysURL   string
	AllowedAudiences []string
	Mode             Mode
	LegacyFallback   bool
	AllowInsecure    bool
}

func (*GrpcServerConfig) AddFlags(fs *pflag.FlagSet) {
	fs.String("grpc_server_authentication.mode", string(ModeCloud), "gRPC server authentication mode")
	fs.String("grpc_server_authentication.signing_keys_url", "", "gRPC server authentication signing keys URL")
	fs.StringSlice("grpc_server_authentication.allowed_audiences", []string{}, "gRPC server authentication allowed audiences")
}

func ReadGrpcServerConfig(cfg *setting.Cfg) (*GrpcServerConfig, error) {
	section := cfg.SectionWithEnvOverrides("grpc_server_authentication")

	mode := Mode(section.Key("mode").MustString(string(ModeOnPrem)))
	if !mode.IsValid() {
		return nil, fmt.Errorf("grpc_server_authentication: invalid mode %q", mode)
	}

	return &GrpcServerConfig{
		SigningKeysURL:   section.Key("signing_keys_url").MustString(""),
		AllowedAudiences: section.Key("allowed_audiences").Strings(","),
		Mode:             mode,
		LegacyFallback:   section.Key("legacy_fallback").MustBool(true),
	}, nil
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
