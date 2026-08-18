package sso

import (
	"fmt"

	"github.com/grafana/authlib/authn"
	"k8s.io/client-go/rest"

	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/setting"
)

// NewSettingsClient builds the MT-Settings client backing the SSOSetting kind.
// The returned Service also implements settingsvc.Writer (reads + writes). It
// deliberately skips metric registration to avoid colliding with the
// ssosettings read client.
func NewSettingsClient(cfg *setting.Cfg) (settingsvc.Service, error) {
	settingsSec := cfg.SectionWithEnvOverrides("settings_service")
	url := settingsSec.Key("url").String()
	if url == "" {
		return nil, fmt.Errorf("settings_service.url is not configured")
	}

	grpcAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	tokenClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		Token:            grpcAuth.Key("token").String(),
		TokenExchangeURL: grpcAuth.Key("token_exchange_url").String(),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	tlsSec := cfg.SectionWithEnvOverrides("tls_client_config")
	svc, err := settingsvc.New(settingsvc.Config{
		URL:                 url,
		TokenExchangeClient: tokenClient,
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: tlsSec.Key("insecure").MustBool(false),
			CAFile:   tlsSec.Key("root_ca_file").String(),
		},
		ServiceName: "grafana-sso-settings-store",
		// Disable read caching: the store's writes bypass this client's cache,
		// so caching would serve stale reads right after a write.
		CacheTTL: -1,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create settings client: %w", err)
	}
	return svc, nil
}
