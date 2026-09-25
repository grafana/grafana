package socialimpl

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/supportbundles"
)

type SocialService struct {
	cfgProvider   configprovider.ConfigProvider
	socialMap     map[string]social.SocialConnector
	log           log.Logger
	features      featuremgmt.FeatureToggles
	cache         remotecache.CacheStorage
	orgRoleMapper *connectors.OrgRoleMapper
	ssoSettings   ssosettings.Service
}

func ProvideService(ctx context.Context,
	cfgProvider configprovider.ConfigProvider,
	features featuremgmt.FeatureToggles,
	usageStats usagestats.Service,
	bundleRegistry supportbundles.Service,
	cache remotecache.CacheStorage,
	orgRoleMapper *connectors.OrgRoleMapper,
	ssoSettings ssosettings.Service,
) *SocialService {
	if orgRoleMapper == nil {
		orgRoleMapper = connectors.ProvideOrgRoleMapper(cfgProvider, nil)
	}

	ss := &SocialService{
		cfgProvider:   cfgProvider,
		socialMap:     make(map[string]social.SocialConnector),
		log:           log.New("login.social"),
		features:      features,
		cache:         cache,
		orgRoleMapper: orgRoleMapper,
		ssoSettings:   ssoSettings,
	}

	usageStats.RegisterMetricsFunc(ss.getUsageStats)

	allSettings, err := ssoSettings.List(ctx)
	if err != nil {
		ss.log.Error("Failed to get SSO settings", "error", err)
	}

	for _, ssoSetting := range allSettings {
		// ignore non-oauth2 providers
		if !slices.Contains(ssosettings.AllOAuthProviders, ssoSetting.Provider) {
			continue
		}

		info, err := connectors.CreateOAuthInfoFromKeyValuesWithLogging(ss.log, ssoSetting.Provider, ssoSetting.Settings)
		if err != nil {
			ss.log.Error("Failed to create OAuthInfo for provider", "error", err, "provider", ssoSetting.Provider)
			continue
		}

		conn, err := ss.createOAuthConnector(ctx, ssoSetting.Provider, info, true)
		if err != nil {
			ss.log.Error("Failed to create OAuth provider", "error", err, "provider", ssoSetting.Provider)
			continue
		}

		ss.socialMap[ssoSetting.Provider] = conn
	}

	ss.registerSupportBundleCollectors(bundleRegistry)

	return ss
}

// GetOAuthProviders returns available oauth providers and if they're enabled or not
func (ss *SocialService) GetOAuthProviders(ctx context.Context) (map[string]bool, error) {
	result := map[string]bool{}

	settingsList, err := ss.ssoSettings.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list OAuth settings: %w", err)
	}
	for _, settings := range settingsList {
		if !slices.Contains(ssosettings.AllOAuthProviders, settings.Provider) {
			continue
		}
		info, err := connectors.CreateOAuthInfoFromKeyValuesWithLogging(ss.log, settings.Provider, settings.Settings)
		if err != nil {
			ss.log.Error("Failed to create OAuth info", "provider", settings.Provider, "error", err)
			continue
		}
		result[settings.Provider] = info.Enabled
	}

	return result, nil
}

func (ss *SocialService) GetOAuthHttpClient(ctx context.Context, name string) (*http.Client, error) {
	// The socialMap keys don't have "oauth_" prefix, but everywhere else in the system does
	name = strings.TrimPrefix(name, "oauth_")
	info, err := ss.GetOAuthInfoProvider(ctx, name)
	if err != nil {
		return nil, err
	}
	if !info.Enabled {
		return nil, fmt.Errorf("oauth provider %q is not enabled", name)
	}

	timeout := 15 * time.Second
	if info.TokenExchangeTimeout > 0 {
		timeout = time.Duration(info.TokenExchangeTimeout) * time.Second
	}

	// handle call back
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: info.TlsSkipVerify,
		},
		DialContext: (&net.Dialer{
			Timeout:   timeout,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   timeout,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	}

	oauthClient := &http.Client{
		Transport: tr,
		Timeout:   timeout,
	}

	if info.TlsClientCert != "" || info.TlsClientKey != "" {
		cert, err := tls.LoadX509KeyPair(info.TlsClientCert, info.TlsClientKey)
		if err != nil {
			ss.log.Error("Failed to setup TlsClientCert", "oauth", name, "error", err)
			return nil, fmt.Errorf("failed to setup TlsClientCert: %w", err)
		}

		tr.TLSClientConfig.Certificates = append(tr.TLSClientConfig.Certificates, cert)
	}

	if info.TlsClientCa != "" {
		caCert, err := os.ReadFile(info.TlsClientCa)
		if err != nil {
			ss.log.Error("Failed to setup TlsClientCa", "oauth", name, "error", err)
			return nil, fmt.Errorf("failed to setup TlsClientCa: %w", err)
		}
		caCertPool := x509.NewCertPool()
		caCertPool.AppendCertsFromPEM(caCert)
		tr.TLSClientConfig.RootCAs = caCertPool
	}
	return oauthClient, nil
}

func (ss *SocialService) GetConnector(ctx context.Context, name string) (social.SocialConnector, error) {
	// The socialMap keys don't have "oauth_" prefix, but everywhere else in the system does
	provider := strings.TrimPrefix(name, "oauth_")
	info, err := ss.GetOAuthInfoProvider(ctx, provider)
	if err != nil {
		return nil, err
	}
	return ss.createOAuthConnector(ctx, provider, info, false)
}

func (ss *SocialService) GetOAuthInfoProvider(ctx context.Context, name string) (*social.OAuthInfo, error) {
	// The socialMap keys don't have "oauth_" prefix, but everywhere else in the system does
	provider := strings.TrimPrefix(name, "oauth_")
	settings, err := ss.ssoSettings.GetForProvider(ctx, provider)
	if err != nil {
		return nil, fmt.Errorf("get OAuth settings for %q: %w", provider, err)
	}
	if settings == nil {
		return nil, fmt.Errorf("could not find %q in OAuth settings", provider)
	}

	return ss.oauthInfoFromSettings(ctx, provider, settings.Settings)
}

// GetOAuthInfoProviders returns enabled OAuth providers
func (ss *SocialService) GetOAuthInfoProviders(ctx context.Context) (map[string]*social.OAuthInfo, error) {
	result := map[string]*social.OAuthInfo{}
	settingsList, err := ss.ssoSettings.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list OAuth settings: %w", err)
	}
	for _, settings := range settingsList {
		if !slices.Contains(ssosettings.AllOAuthProviders, settings.Provider) {
			continue
		}
		info, err := ss.oauthInfoFromSettings(ctx, settings.Provider, settings.Settings)
		if err != nil {
			ss.log.Error("Failed to create OAuth info", "provider", settings.Provider, "error", err)
			continue
		}
		if info.Enabled {
			result[settings.Provider] = info
		}
	}
	return result, nil
}

func (ss *SocialService) oauthInfoFromSettings(ctx context.Context, provider string, settings map[string]any) (*social.OAuthInfo, error) {
	info, err := connectors.CreateOAuthInfoFromKeyValuesWithLogging(ss.log, provider, settings)
	if err != nil {
		return nil, fmt.Errorf("create OAuth info for %q: %w", provider, err)
	}
	if provider == social.GrafanaComProviderName {
		cfg, err := ss.cfgProvider.Get(ctx)
		if err != nil {
			return nil, fmt.Errorf("get configuration for OAuth provider %q: %w", provider, err)
		}
		info.AuthUrl = cfg.GrafanaComURL + "/oauth2/authorize"
		info.TokenUrl = cfg.GrafanaComURL + "/api/oauth2/token"
		info.AuthStyle = "inheader"
	}
	return info, nil
}

func (ss *SocialService) getUsageStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	authTypes := map[string]bool{}
	providers, err := ss.GetOAuthProviders(ctx)
	if err != nil {
		return nil, err
	}
	for provider, enabled := range providers {
		authTypes["oauth_"+provider] = enabled
	}

	for authType, enabled := range authTypes {
		enabledValue := 0
		if enabled {
			enabledValue = 1
		}

		m["stats.auth_enabled."+authType+".count"] = enabledValue
	}

	return m, nil
}

func (ss *SocialService) createOAuthConnector(ctx context.Context, name string, info *social.OAuthInfo, registerReloadable bool) (social.SocialConnector, error) {
	var settingsService ssosettings.Service
	if registerReloadable {
		settingsService = ss.ssoSettings
	}
	switch name {
	case social.AzureADProviderName:
		return connectors.NewAzureADProvider(ctx, info, ss.cfgProvider, ss.orgRoleMapper, settingsService, ss.features, ss.cache)
	case social.GenericOAuthProviderName:
		return connectors.NewGenericOAuthProvider(ctx, info, ss.cfgProvider, ss.orgRoleMapper, settingsService, ss.features, ss.cache)
	case social.GitHubProviderName:
		return connectors.NewGitHubProvider(ctx, info, ss.cfgProvider, ss.orgRoleMapper, settingsService, ss.features)
	case social.GitlabProviderName:
		return connectors.NewGitLabProvider(ctx, info, ss.cfgProvider, ss.orgRoleMapper, settingsService, ss.features, ss.cache)
	case social.GoogleProviderName:
		return connectors.NewGoogleProvider(ctx, info, ss.cfgProvider, ss.orgRoleMapper, settingsService, ss.features, ss.cache)
	case social.GrafanaComProviderName:
		return connectors.NewGrafanaComProvider(ctx, info, ss.cfgProvider, ss.orgRoleMapper, settingsService, ss.features)
	case social.OktaProviderName:
		return connectors.NewOktaProvider(ctx, info, ss.cfgProvider, ss.orgRoleMapper, settingsService, ss.features, ss.cache)
	default:
		return nil, fmt.Errorf("unknown oauth provider: %s", name)
	}
}

// convertIniSectionToMap converts key value pairs from an ini section to a map[string]any
func convertIniSectionToMap(sec *ini.Section) map[string]any {
	mappedSettings := make(map[string]any)
	for k, v := range sec.KeysHash() {
		mappedSettings[k] = v
	}
	return mappedSettings
}
