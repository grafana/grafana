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

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	allOauthes = []string{social.GitHubProviderName, social.GitlabProviderName, social.GoogleProviderName, social.GenericOAuthProviderName, social.GrafanaNetProviderName,
		social.GrafanaComProviderName, social.AzureADProviderName, social.OktaProviderName}
)

type SocialService struct {
	cfg *setting.Cfg

	socialMap map[string]social.SocialConnector
	log       log.Logger
}

func ProvideService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	usageStats usagestats.Service,
	bundleRegistry supportbundles.Service,
	cache remotecache.CacheStorage,
	orgRoleMapper *connectors.OrgRoleMapper,
	ssoSettings ssosettings.Service,
) *SocialService {
	ss := &SocialService{
		cfg:       cfg,
		socialMap: make(map[string]social.SocialConnector),
		log:       log.New("login.social"),
	}

	usageStats.RegisterMetricsFunc(ss.getUsageStats)

	if features.IsEnabledGlobally(featuremgmt.FlagSsoSettingsApi) {
		allSettings, err := ssoSettings.List(context.Background())
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

			conn, err := createOAuthConnector(ssoSetting.Provider, info, cfg, orgRoleMapper, ssoSettings, features, cache)
			if err != nil {
				ss.log.Error("Failed to create OAuth provider", "error", err, "provider", ssoSetting.Provider)
				continue
			}

			ss.socialMap[ssoSetting.Provider] = conn
		}
	} else {
		for _, name := range allOauthes {
			sec := cfg.Raw.Section("auth." + name)

			settingsKVs := convertIniSectionToMap(sec)

			info, err := connectors.CreateOAuthInfoFromKeyValuesWithLogging(ss.log, name, settingsKVs)
			if err != nil {
				ss.log.Error("Failed to create OAuthInfo for provider", "error", err, "provider", name)
				continue
			}

			if !info.Enabled {
				continue
			}

			if name == social.GrafanaNetProviderName {
				name = social.GrafanaComProviderName
			}

			conn, _ := createOAuthConnector(name, info, cfg, orgRoleMapper, ssoSettings, features, cache)

			ss.socialMap[name] = conn
		}
	}

	ss.registerSupportBundleCollectors(bundleRegistry)

	return ss
}

// GetOAuthProviders returns available oauth providers and if they're enabled or not
func (ss *SocialService) GetOAuthProviders() map[string]bool {
	result := map[string]bool{}

	for name, conn := range ss.socialMap {
		result[name] = conn.GetOAuthInfo().Enabled
	}

	return result
}

func (ss *SocialService) GetOAuthHttpClient(name string) (*http.Client, error) {
	// The socialMap keys don't have "oauth_" prefix, but everywhere else in the system does
	name = strings.TrimPrefix(name, "oauth_")
	provider, ok := ss.socialMap[name]
	if !ok {
		return nil, fmt.Errorf("could not find %q in OAuth Settings", name)
	}

	info := provider.GetOAuthInfo()
	if !info.Enabled {
		return nil, fmt.Errorf("oauth provider %q is not enabled", name)
	}

	// handle call back
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: info.TlsSkipVerify,
		},
		DialContext: (&net.Dialer{
			Timeout:   time.Second * 10,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	}

	oauthClient := &http.Client{
		Transport: tr,
		Timeout:   time.Second * 15,
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

func (ss *SocialService) GetConnector(name string) (social.SocialConnector, error) {
	// The socialMap keys don't have "oauth_" prefix, but everywhere else in the system does
	provider := strings.TrimPrefix(name, "oauth_")
	connector, ok := ss.socialMap[provider]
	if !ok {
		return nil, fmt.Errorf("failed to find oauth provider for %q", name)
	}
	return connector, nil
}

func (ss *SocialService) GetOAuthInfoProvider(name string) *social.OAuthInfo {
	// The socialMap keys don't have "oauth_" prefix, but everywhere else in the system does
	provider := strings.TrimPrefix(name, "oauth_")
	connector, ok := ss.socialMap[provider]
	if !ok {
		return nil
	}
	return connector.GetOAuthInfo()
}

// GetOAuthInfoProviders returns enabled OAuth providers
func (ss *SocialService) GetOAuthInfoProviders() map[string]*social.OAuthInfo {
	result := map[string]*social.OAuthInfo{}
	for name, connector := range ss.socialMap {
		info := connector.GetOAuthInfo()
		if info.Enabled {
			result[name] = info
		}
	}
	return result
}

func (ss *SocialService) getUsageStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	authTypes := map[string]bool{}
	for provider, enabled := range ss.GetOAuthProviders() {
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

func createOAuthConnector(name string, info *social.OAuthInfo, cfg *setting.Cfg, orgRoleMapper *connectors.OrgRoleMapper, ssoSettings ssosettings.Service, features featuremgmt.FeatureToggles, cache remotecache.CacheStorage) (social.SocialConnector, error) {
	switch name {
	case social.AzureADProviderName:
		return connectors.NewAzureADProvider(info, cfg, orgRoleMapper, ssoSettings, features, cache), nil
	case social.GenericOAuthProviderName:
		return connectors.NewGenericOAuthProvider(info, cfg, orgRoleMapper, ssoSettings, features), nil
	case social.GitHubProviderName:
		return connectors.NewGitHubProvider(info, cfg, orgRoleMapper, ssoSettings, features), nil
	case social.GitlabProviderName:
		return connectors.NewGitLabProvider(info, cfg, orgRoleMapper, ssoSettings, features), nil
	case social.GoogleProviderName:
		return connectors.NewGoogleProvider(info, cfg, orgRoleMapper, ssoSettings, features), nil
	case social.GrafanaComProviderName:
		return connectors.NewGrafanaComProvider(info, cfg, orgRoleMapper, ssoSettings, features), nil
	case social.OktaProviderName:
		return connectors.NewOktaProvider(info, cfg, orgRoleMapper, ssoSettings, features), nil
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
