package grpcutils

import (
	"fmt"

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

type GrpcClientConfig struct {
	Token            string
	TokenExchangeURL string
	TokenNamespace   string
	Mode             Mode
}

func ReadGrpcClientConfig(cfg *setting.Cfg) (*GrpcClientConfig, error) {
	section := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	mode := Mode(section.Key("mode").MustString(string(ModeOnPrem)))
	if !mode.IsValid() {
		return nil, fmt.Errorf("grpc_client_authentication: invalid mode %q", mode)
	}

	return &GrpcClientConfig{
		Token:            section.Key("token").MustString(""),
		TokenExchangeURL: section.Key("token_exchange_url").MustString(""),
		TokenNamespace:   section.Key("token_namespace").MustString("stack-" + cfg.StackID),
		Mode:             mode,
	}, nil
}

type GrpcServerConfig struct {
	SigningKeysURL   string
	AllowedAudiences []string
	Mode             Mode
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
	}, nil
}
