package strategies

import (
	"context"
	"errors"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	oftesting "github.com/open-feature/go-sdk/openfeature/testing"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeSettingsLister struct {
	settings    []*settingsvc.Setting
	err         error
	gotSelector metav1.LabelSelector
}

func (f *fakeSettingsLister) List(_ context.Context, selector metav1.LabelSelector) ([]*settingsvc.Setting, error) {
	f.gotSelector = selector
	if f.err != nil {
		return nil, f.err
	}
	return f.settings, nil
}

var provider = oftesting.NewTestProvider()

func TestMain(m *testing.M) {
	if err := openfeature.SetProviderAndWait(provider); err != nil {
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
			NewMTSettingsOAuthStrategy(nil, true),
			NewMTSettingsLDAPStrategy(nil, true),
			NewMTSettingsSAMLStrategy(nil, true),
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

		oauth := NewMTSettingsOAuthStrategy(nil, true)
		ldap := NewMTSettingsLDAPStrategy(nil, true)
		saml := NewMTSettingsSAMLStrategy(nil, true)

		for _, p := range ssosettings.AllOAuthProviders {
			require.True(t, oauth.IsMatch(t.Context(), p))
			require.False(t, ldap.IsMatch(t.Context(), p))
			require.False(t, saml.IsMatch(t.Context(), p))
		}

		require.True(t, saml.IsMatch(t.Context(), social.SAMLProviderName))
		require.False(t, oauth.IsMatch(t.Context(), social.SAMLProviderName))
		require.False(t, ldap.IsMatch(t.Context(), social.SAMLProviderName))
	})

	t.Run("the LDAP adapter matches nothing until its representation is decided", func(t *testing.T) {
		provider.UsingFlags(t, toggleFlags(true))

		ldap := NewMTSettingsLDAPStrategy(nil, true)

		require.False(t, ldap.IsMatch(t.Context(), social.LDAPProviderName))
	})

	t.Run("no adapter matches below the storage read-flip even when the toggle is enabled", func(t *testing.T) {
		provider.UsingFlags(t, toggleFlags(true))

		adapters := []ssosettings.FallbackStrategy{
			NewMTSettingsOAuthStrategy(nil, false),
			NewMTSettingsLDAPStrategy(nil, false),
			NewMTSettingsSAMLStrategy(nil, false),
		}
		providers := append([]string{}, ssosettings.AllOAuthProviders...)
		providers = append(providers, social.LDAPProviderName, social.SAMLProviderName)

		for _, adapter := range adapters {
			for _, p := range providers {
				require.False(t, adapter.IsMatch(t.Context(), p))
			}
		}
	})
}

func TestMTSettingsStrategies_GetProviderConfig(t *testing.T) {
	t.Run("returns the auth.<provider> section rows keyed like ini keys", func(t *testing.T) {
		lister := &fakeSettingsLister{settings: []*settingsvc.Setting{
			{Section: "auth.generic_oauth", Key: "enabled", Value: "true"},
			{Section: "auth.generic_oauth", Key: "client_id", Value: "grafana-oauth"},
			{Section: "auth.generic_oauth", Key: "auth_url", Value: "http://localhost:8087/auth"},
		}}

		config, err := NewMTSettingsOAuthStrategy(lister, true).GetProviderConfig(context.Background(), social.GenericOAuthProviderName)

		require.NoError(t, err)
		require.Equal(t, map[string]any{
			"enabled":   "true",
			"client_id": "grafana-oauth",
			"auth_url":  "http://localhost:8087/auth",
		}, config)
		require.Equal(t, map[string]string{"section": "auth.generic_oauth"}, lister.gotSelector.MatchLabels)
	})

	t.Run("an absent section yields an empty map", func(t *testing.T) {
		lister := &fakeSettingsLister{}

		config, err := NewMTSettingsSAMLStrategy(lister, true).GetProviderConfig(context.Background(), social.SAMLProviderName)

		require.NoError(t, err)
		require.Empty(t, config)
		require.NotNil(t, config)
		require.Equal(t, map[string]string{"section": "auth.saml"}, lister.gotSelector.MatchLabels)
	})

	t.Run("the last row wins on duplicate keys", func(t *testing.T) {
		lister := &fakeSettingsLister{settings: []*settingsvc.Setting{
			{Section: "auth.generic_oauth", Key: "enabled", Value: "false"},
			{Section: "auth.generic_oauth", Key: "enabled", Value: "true"},
		}}

		config, err := NewMTSettingsOAuthStrategy(lister, true).GetProviderConfig(context.Background(), social.GenericOAuthProviderName)

		require.NoError(t, err)
		require.Equal(t, map[string]any{"enabled": "true"}, config)
	})

	t.Run("a list error propagates to the caller", func(t *testing.T) {
		listErr := errors.New("settings service unavailable")
		lister := &fakeSettingsLister{err: listErr}

		config, err := NewMTSettingsOAuthStrategy(lister, true).GetProviderConfig(context.Background(), social.GitHubProviderName)

		require.Nil(t, config)
		require.ErrorIs(t, err, listErr)
	})

	t.Run("a missing client fails loudly", func(t *testing.T) {
		config, err := NewMTSettingsOAuthStrategy(nil, true).GetProviderConfig(context.Background(), social.GenericOAuthProviderName)

		require.Nil(t, config)
		require.ErrorIs(t, err, ssosettings.ErrMTSettingsClientNotConfigured)
	})

	t.Run("LDAP stays not-implemented until its representation is decided", func(t *testing.T) {
		lister := &fakeSettingsLister{settings: []*settingsvc.Setting{
			{Section: "auth.ldap", Key: "enabled", Value: "true"},
		}}

		config, err := NewMTSettingsLDAPStrategy(lister, true).GetProviderConfig(context.Background(), social.LDAPProviderName)

		require.Nil(t, config)
		require.ErrorIs(t, err, ssosettings.ErrMTSettingsNotImplemented)
	})
}
