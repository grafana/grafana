package ssosettingsimpl

import (
	"errors"
	"fmt"

	"github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/rest"

	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/setting"
)

// newMTSettingsClient initializes the MT-Settings client for the MT-Settings
// fallback strategies. Expected configuration:
//
// [tls_client_config]
// root_ca_file =
// insecure =
//
// [grpc_client_authentication]
// token =
// token_exchange_url =
//
// [settings_service]
// url =
// qps =
// burst =
// cache_ttl =
//
// Returns nil without error when [settings_service] url is not configured:
// the MT-Settings strategies are gated off by the ssoSettingsToMTSettings
// feature toggle and fail loudly on read, so an absent client is only
// reachable through an explicit misconfiguration.
func newMTSettingsClient(cfg *setting.Cfg, promRegister prometheus.Registerer) (settingsvc.Service, error) {
	settingsSec := cfg.SectionWithEnvOverrides("settings_service")
	settingsServiceURL := settingsSec.Key("url").String()
	if settingsServiceURL == "" {
		return nil, nil
	}

	tlsConfigSection := cfg.SectionWithEnvOverrides("tls_client_config")
	tlsConfig := rest.TLSClientConfig{
		Insecure: tlsConfigSection.Key("insecure").MustBool(false),
		CAFile:   tlsConfigSection.Key("root_ca_file").String(),
	}

	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	token := gRPCAuth.Key("token").String()
	tokenExchangeURL := gRPCAuth.Key("token_exchange_url").String()
	if token == "" {
		return nil, fmt.Errorf("grpc_client_authentication.token is required for the settings service")
	}
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("grpc_client_authentication.token_exchange_url is required for the settings service")
	}

	tokenClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		Token:            token,
		TokenExchangeURL: tokenExchangeURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	settingsService, err := settingsvc.New(settingsvc.Config{
		URL:                 settingsServiceURL,
		TokenExchangeClient: tokenClient,
		TLSClientConfig:     tlsConfig,
		QPS:                 float32(settingsSec.Key("qps").MustFloat64(0)),
		Burst:               settingsSec.Key("burst").MustInt(0),
		CacheTTL:            settingsSec.Key("cache_ttl").MustDuration(0),
		ServiceName:         "grafana-sso-settings",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create settings service client: %w", err)
	}

	if err := promRegister.Register(settingsService); err != nil {
		var alreadyRegisteredErr prometheus.AlreadyRegisteredError
		if !errors.As(err, &alreadyRegisteredErr) {
			return nil, fmt.Errorf("failed to register settings service metrics: %w", err)
		}
	}

	return settingsService, nil
}
