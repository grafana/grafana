package ssosettingsimpl

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/rest"

	grafanarequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/services/ssosettings/strategies"
	"github.com/grafana/grafana/pkg/setting"
)

// namespacedSettingsClient scopes every List to the instance's namespace.
// Provider settings are instance-global, so the namespace comes from the
// instance configuration rather than the caller's context: reload paths run
// on background contexts that carry no namespace.
type namespacedSettingsClient struct {
	svc       settingsvc.Service
	namespace string
}

var _ strategies.SettingsLister = (*namespacedSettingsClient)(nil)

func (c *namespacedSettingsClient) List(ctx context.Context, selector metav1.LabelSelector) ([]*settingsvc.Setting, error) {
	return c.svc.List(request.WithNamespace(ctx, c.namespace), selector)
}

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
//
// Mirrors setupSettingsService in pkg/services/frontend/settings_service.go —
// keep the config keys in sync when either changes.
func newMTSettingsClient(cfg *setting.Cfg, promRegister prometheus.Registerer) (strategies.SettingsLister, error) {
	settingsSec := cfg.SectionWithEnvOverrides("settings_service")
	settingsServiceURL := settingsSec.Key("url").String()
	if settingsServiceURL == "" {
		return nil, nil
	}

	// A malformed stack ID would otherwise be silently mapped to stacks-0 by
	// the namespace mapper, pointing a credentialed cross-service client at
	// the wrong tenant's settings — fail closed instead.
	if cfg.StackID != "" {
		if _, err := strconv.ParseInt(cfg.StackID, 10, 64); err != nil {
			return nil, fmt.Errorf("stack_id %q is not numeric; refusing to derive a settings-service namespace from it", cfg.StackID)
		}
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

	// SSO settings are instance-global, so the org-1 namespace stands in for
	// the whole instance; with a stack ID configured the mapper is constant.
	return &namespacedSettingsClient{
		svc:       settingsService,
		namespace: grafanarequest.GetNamespaceMapper(cfg)(1),
	}, nil
}
