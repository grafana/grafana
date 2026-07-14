package strategies

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	oftesting "github.com/open-feature/go-sdk/openfeature/testing"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

var provider = oftesting.NewTestProvider()

func TestMain(m *testing.M) {
	if err := openfeature.SetProvider(provider); err != nil {
		panic(err)
	}

	m.Run()
}

func toggleFlags(enabled bool) map[string]memprovider.InMemoryFlag {
	return map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagGrafanaSsoSettingsToMTSettings: setting.NewInMemoryFlag(featuremgmt.FlagGrafanaSsoSettingsToMTSettings, enabled),
	}
}

func TestMTSettingsStrategies_IsMatch(t *testing.T) {
	t.Run("no adapter matches any provider when the toggle is disabled", func(t *testing.T) {
		provider.UsingFlags(t, toggleFlags(false))

		adapters := []ssosettings.FallbackStrategy{
			NewMTSettingsOAuthStrategy(),
			NewMTSettingsLDAPStrategy(),
			NewMTSettingsSAMLStrategy(),
		}
		providers := append([]string{}, ssosettings.AllOAuthProviders...)
		providers = append(providers, social.LDAPProviderName, social.SAMLProviderName)

		for _, adapter := range adapters {
			for _, p := range providers {
				require.False(t, adapter.IsMatch(t.Context(), p))
			}
		}
	})

	t.Run("each adapter matches exactly its own family when the toggle is enabled", func(t *testing.T) {
		provider.UsingFlags(t, toggleFlags(true))

		oauth := NewMTSettingsOAuthStrategy()
		ldap := NewMTSettingsLDAPStrategy()
		saml := NewMTSettingsSAMLStrategy()

		for _, p := range ssosettings.AllOAuthProviders {
			require.True(t, oauth.IsMatch(t.Context(), p))
			require.False(t, ldap.IsMatch(t.Context(), p))
			require.False(t, saml.IsMatch(t.Context(), p))
		}

		require.True(t, ldap.IsMatch(t.Context(), social.LDAPProviderName))
		require.False(t, oauth.IsMatch(t.Context(), social.LDAPProviderName))
		require.False(t, saml.IsMatch(t.Context(), social.LDAPProviderName))

		require.True(t, saml.IsMatch(t.Context(), social.SAMLProviderName))
		require.False(t, oauth.IsMatch(t.Context(), social.SAMLProviderName))
		require.False(t, ldap.IsMatch(t.Context(), social.SAMLProviderName))
	})
}

func TestMTSettingsStrategies_GetProviderConfig(t *testing.T) {
	provider.UsingFlags(t, toggleFlags(true))

	testCases := []struct {
		adapter  ssosettings.FallbackStrategy
		provider string
	}{
		{NewMTSettingsOAuthStrategy(), social.GenericOAuthProviderName},
		{NewMTSettingsLDAPStrategy(), social.LDAPProviderName},
		{NewMTSettingsSAMLStrategy(), social.SAMLProviderName},
	}

	for _, tc := range testCases {
		config, err := tc.adapter.GetProviderConfig(context.Background(), tc.provider)

		require.Nil(t, config)
		require.ErrorIs(t, err, ssosettings.ErrMTSettingsNotImplemented)
	}
}
