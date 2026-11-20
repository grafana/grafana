package connectors

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

func testConfigProvider(t *testing.T, cfg *setting.Cfg) configprovider.ConfigProvider {
	t.Helper()
	provider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	return provider
}

func mustProvideOrgRoleMapper(t *testing.T, cfg *setting.Cfg, orgService org.Service) *OrgRoleMapper {
	t.Helper()
	return ProvideOrgRoleMapper(testConfigProvider(t, cfg), orgService)
}

func mustNewAzureADProvider(t *testing.T, info *social.OAuthInfo, cfg *setting.Cfg, mapper *OrgRoleMapper, settings ssosettings.Service, features featuremgmt.FeatureToggles, cache remotecache.CacheStorage) *SocialAzureAD {
	t.Helper()
	provider, err := NewAzureADProvider(context.Background(), info, testConfigProvider(t, cfg), mapper, settings, features, cache)
	require.NoError(t, err)
	return provider
}

func mustNewGenericOAuthProvider(t *testing.T, info *social.OAuthInfo, cfg *setting.Cfg, mapper *OrgRoleMapper, settings ssosettings.Service, features featuremgmt.FeatureToggles, cache remotecache.CacheStorage) *SocialGenericOAuth {
	t.Helper()
	provider, err := NewGenericOAuthProvider(context.Background(), info, testConfigProvider(t, cfg), mapper, settings, features, cache)
	require.NoError(t, err)
	return provider
}

func mustNewGitHubProvider(t *testing.T, info *social.OAuthInfo, cfg *setting.Cfg, mapper *OrgRoleMapper, settings ssosettings.Service, features featuremgmt.FeatureToggles) *SocialGithub {
	t.Helper()
	provider, err := NewGitHubProvider(context.Background(), info, testConfigProvider(t, cfg), mapper, settings, features)
	require.NoError(t, err)
	return provider
}

func mustNewGitLabProvider(t *testing.T, info *social.OAuthInfo, cfg *setting.Cfg, mapper *OrgRoleMapper, settings ssosettings.Service, features featuremgmt.FeatureToggles, cache remotecache.CacheStorage) *SocialGitlab {
	t.Helper()
	provider, err := NewGitLabProvider(context.Background(), info, testConfigProvider(t, cfg), mapper, settings, features, cache)
	require.NoError(t, err)
	return provider
}

func mustNewGoogleProvider(t *testing.T, info *social.OAuthInfo, cfg *setting.Cfg, mapper *OrgRoleMapper, settings ssosettings.Service, features featuremgmt.FeatureToggles, cache remotecache.CacheStorage) *SocialGoogle {
	t.Helper()
	provider, err := NewGoogleProvider(context.Background(), info, testConfigProvider(t, cfg), mapper, settings, features, cache)
	require.NoError(t, err)
	return provider
}

func mustNewGrafanaComProvider(t *testing.T, info *social.OAuthInfo, cfg *setting.Cfg, mapper *OrgRoleMapper, settings ssosettings.Service, features featuremgmt.FeatureToggles) *SocialGrafanaCom {
	t.Helper()
	provider, err := NewGrafanaComProvider(context.Background(), info, testConfigProvider(t, cfg), mapper, settings, features)
	require.NoError(t, err)
	return provider
}

func mustNewOktaProvider(t *testing.T, info *social.OAuthInfo, cfg *setting.Cfg, mapper *OrgRoleMapper, settings ssosettings.Service, features featuremgmt.FeatureToggles, cache remotecache.CacheStorage) *SocialOkta {
	t.Helper()
	provider, err := NewOktaProvider(context.Background(), info, testConfigProvider(t, cfg), mapper, settings, features, cache)
	require.NoError(t, err)
	return provider
}
