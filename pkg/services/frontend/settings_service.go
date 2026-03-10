package frontend

import (
	"errors"
	"fmt"

	"github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/rest"

	settingservice "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/setting"
)

// setupSettingsService initializes the Settings Service client if configured.
// Expected configuration:
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
//
// Returns nil if not configured (this is not an error condition). Errors returned should
// be considered critical.
func setupSettingsService(cfg *setting.Cfg, promRegister prometheus.Registerer) (settingservice.Service, error) {
	settingsSec := cfg.SectionWithEnvOverrides("settings_service")
	settingsServiceURL := settingsSec.Key("url").String()
	settingsServiceQPS := float32(settingsSec.Key("qps").MustFloat64(0))
	settingsServiceBurst := settingsSec.Key("burst").MustInt(0)
	if settingsServiceURL == "" {
		// If settings service URL is not configured, return nil *without* error
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
		return nil, fmt.Errorf("grpc_client_authentication.token is required for settings service")
	}
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("grpc_client_authentication.token_exchange_url is required for settings service")
	}

	tokenClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		Token:            token,
		TokenExchangeURL: tokenExchangeURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	settingsService, err := settingservice.New(settingservice.Config{
		URL:                 settingsServiceURL,
		TokenExchangeClient: tokenClient,
		TLSClientConfig:     tlsConfig,
		QPS:                 settingsServiceQPS,
		Burst:               settingsServiceBurst,
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
