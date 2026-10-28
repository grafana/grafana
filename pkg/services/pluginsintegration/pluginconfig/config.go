package pluginconfig

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// ProvidePluginManagementConfig returns a new config.PluginManagementCfg.
// It is used to provide configuration to Grafana's implementation of the plugin management system.
func ProvidePluginManagementConfig(cfg *setting.Cfg, settingProvider setting.Provider, features featuremgmt.FeatureToggles) (*config.PluginManagementCfg, error) {
	plugins := settingProvider.Section("plugins")
	allowedUnsigned := cfg.PluginsAllowUnsigned
	if len(plugins.KeyValue("allow_loading_unsigned_plugins").Value()) > 0 {
		allowedUnsigned = strings.Split(plugins.KeyValue("allow_loading_unsigned_plugins").Value(), ",")
	}

	return config.NewPluginManagementCfg(
		settingProvider.KeyValue("", "app_mode").MustBool(cfg.Env == setting.Dev),
		cfg.PluginsPaths,
		extractPluginSettings(settingProvider),
		allowedUnsigned,
		cfg.PluginsCDNURLTemplate,
		cfg.AppURL,
		//nolint:staticcheck // not yet migrated to OpenFeature
		config.Features{
			TempoAlertingEnabled: features.IsEnabledGlobally(featuremgmt.FlagTempoAlerting),
		},
		cfg.GrafanaComAPIURL,
		cfg.DisablePlugins,
		cfg.ForwardHostEnvVars,
		cfg.GrafanaComProxyAPIToken,
	), nil
}

// PluginInstanceCfg contains the configuration for a plugin instance.
// It is used to provide configuration to the plugin instance either via env vars or via each plugin request.
type PluginInstanceCfg struct {
	GrafanaAppURL               string
	MarketplaceLicenseDirectory string
	Features                    featuremgmt.FeatureToggles

	Tracing config.Tracing

	PluginSettings config.PluginSettings
	// DevMode is set when Grafana runs with app_mode = development.
	DevMode bool
	// LocalPluginTokens is set when neither a plugin v3 token exchange nor real
	// signing keys are configured, so Grafana signs the access tokens it sends
	// to plugins itself.
	LocalPluginTokens bool
	// LocalAPIURL is where plugins reach this Grafana process directly. It is
	// inferred from the listener or set by [plugins] local_api_url.
	LocalAPIURL string

	AWSAllowedAuthProviders          []string
	AWSAssumeRoleEnabled             bool
	AWSPerDatasourceHTTPProxyEnabled bool
	AWSExternalId                    string
	AWSSessionDuration               string
	AWSListMetricsPageLimit          string
	AWSForwardSettingsPlugins        []string

	Azure            *azsettings.AzureSettings
	AzureAuthEnabled bool

	ProxySettings setting.SecureSocksDSProxySettings

	OpenFeature setting.OpenFeatureSettings

	GrafanaVersion string

	ConcurrentQueryCount int
	ResponseLimit        int64

	UserFacingDefaultError string

	DataProxyRowLimit int64

	SQLDatasourceMaxOpenConnsDefault    int
	SQLDatasourceMaxIdleConnsDefault    int
	SQLDatasourceMaxConnLifetimeDefault int

	SigV4AuthEnabled    bool
	SigV4VerboseLogging bool

	LiveClientQueueMaxSize int

	// NATSURLs are the NATS client URLs plugins should connect to. Empty when NATS is disabled.
	NATSURLs []string
}

// ProvidePluginInstanceConfig returns a new PluginInstanceCfg.
func ProvidePluginInstanceConfig(cfg *setting.Cfg, settingProvider setting.Provider, features featuremgmt.FeatureToggles, pluginAuth *pluginauth.Config) (*PluginInstanceCfg, error) {
	aws := settingProvider.Section("aws")
	allowedAuth := cfg.AWSAllowedAuthProviders
	if len(aws.KeyValue("allowed_auth_providers").Value()) > 0 {
		allowedAuth = util.SplitString(aws.KeyValue("allowed_auth_providers").Value())
	}
	awsForwardSettingsPlugins := cfg.AWSForwardSettingsPlugins
	if len(aws.KeyValue("forward_settings_to_plugins").Value()) > 0 {
		awsForwardSettingsPlugins = util.SplitString(aws.KeyValue("forward_settings_to_plugins").Value())
	}

	tracingCfg, err := newTracingCfg(cfg)
	if err != nil {
		return nil, fmt.Errorf("new opentelemetry cfg: %w", err)
	}

	if cfg.Azure == nil {
		cfg.Azure = &azsettings.AzureSettings{}
	}

	return &PluginInstanceCfg{
		GrafanaAppURL:                       cfg.AppURL,
		MarketplaceLicenseDirectory:         cfg.MarketplaceLicenseDirectory,
		Features:                            features,
		Tracing:                             tracingCfg,
		PluginSettings:                      extractPluginSettings(settingProvider),
		DevMode:                             cfg.Env == setting.Dev,
		LocalPluginTokens:                   pluginAuth.LocalTokens(),
		LocalAPIURL:                         pluginAuth.LocalAPIURL(),
		AWSAllowedAuthProviders:             allowedAuth,
		AWSAssumeRoleEnabled:                aws.KeyValue("assume_role_enabled").MustBool(cfg.AWSAssumeRoleEnabled),
		AWSPerDatasourceHTTPProxyEnabled:    aws.KeyValue("per_datasource_http_proxy_enabled").MustBool(cfg.AWSPerDatasourceHTTPProxyEnabled),
		AWSExternalId:                       aws.KeyValue("external_id").Value(),
		AWSSessionDuration:                  aws.KeyValue("session_duration").Value(),
		AWSListMetricsPageLimit:             aws.KeyValue("list_metrics_page_limit").Value(),
		AWSForwardSettingsPlugins:           awsForwardSettingsPlugins,
		Azure:                               cfg.Azure,
		AzureAuthEnabled:                    cfg.Azure.AzureAuthEnabled,
		ProxySettings:                       cfg.SecureSocksDSProxy,
		OpenFeature:                         cfg.OpenFeature,
		GrafanaVersion:                      cfg.BuildVersion,
		ConcurrentQueryCount:                cfg.ConcurrentQueryCount,
		UserFacingDefaultError:              cfg.UserFacingDefaultError,
		DataProxyRowLimit:                   cfg.DataProxyRowLimit,
		SQLDatasourceMaxOpenConnsDefault:    cfg.SqlDatasourceMaxOpenConnsDefault,
		SQLDatasourceMaxIdleConnsDefault:    cfg.SqlDatasourceMaxIdleConnsDefault,
		SQLDatasourceMaxConnLifetimeDefault: cfg.SqlDatasourceMaxConnLifetimeDefault,
		ResponseLimit:                       cfg.ResponseLimit,
		SigV4AuthEnabled:                    cfg.SigV4AuthEnabled,
		SigV4VerboseLogging:                 cfg.SigV4VerboseLogging,
		LiveClientQueueMaxSize:              cfg.LiveClientQueueMaxSize,
		NATSURLs:                            natsClientURLs(cfg.NATS),
	}, nil
}

// natsClientURLs mirrors the URLs Grafana's own NATS connections use. It is derived from settings
// rather than the running embedded server because plugins can start before that server does.
func natsClientURLs(cfg setting.NATSSettings) []string {
	if !cfg.Enabled {
		return nil
	}
	if !cfg.Embedded() {
		return append([]string(nil), cfg.ClientURLs...)
	}
	host := cfg.ListenAddress
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	local := url.URL{Scheme: "nats", Host: net.JoinHostPort(host, strconv.Itoa(cfg.ClientPort))}
	return append([]string{local.String()}, cfg.ClientURLs...)
}

func extractPluginSettings(settingProvider setting.Provider) config.PluginSettings {
	ps := config.PluginSettings{}
	for sectionName, sectionCopy := range settingProvider.Current() {
		if !strings.HasPrefix(sectionName, "plugin.") {
			continue
		}
		// Calling Current() returns a redacted version of section. We need to replace the map values with the unredacted values.
		section := settingProvider.Section(sectionName)
		for k := range sectionCopy {
			sectionCopy[k] = section.KeyValue(k).MustString("")
		}
		pluginID := strings.Replace(sectionName, "plugin.", "", 1)
		ps[pluginID] = sectionCopy
	}

	return ps
}
