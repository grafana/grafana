package sso

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type fakeIniLister struct {
	iniFile  *ini.File
	err      error
	selector metav1.LabelSelector
	calls    int
}

func (s *fakeIniLister) ListAsIni(_ context.Context, selector metav1.LabelSelector) (*ini.File, error) {
	s.calls++
	s.selector = selector
	if s.err != nil {
		return nil, s.err
	}
	return s.iniFile, nil
}

func TestTenantConfigProvider_GetSections(t *testing.T) {
	t.Run("lack of sections skips the settings service", func(t *testing.T) {
		settings := &fakeIniLister{}
		cfgProvider := &tenantConfigProvider{settings: settings}
		iniFile, err := cfgProvider.GetSections(t.Context())
		require.NoError(t, err)
		assert.Equal(t, ini.Empty(), iniFile)
		assert.Equal(t, 0, settings.calls)
	})

	t.Run("surfaces errors", func(t *testing.T) {
		errBoom := errors.New("boom")
		settings := &fakeIniLister{err: errBoom}
		cfgProvider := &tenantConfigProvider{settings: settings}
		_, err := cfgProvider.GetSections(t.Context(), "auth")
		require.ErrorIs(t, err, errBoom)
		assert.Equal(t, 1, settings.calls)
	})

	t.Run("filters by requested sections", func(t *testing.T) {
		sections := []string{"auth", "auth.ldap", "users"}
		iniFile := ini.Empty()
		err := iniFile.NewSections(sections...)
		require.NoError(t, err)

		settings := &fakeIniLister{iniFile: iniFile}
		cfgProvider := &tenantConfigProvider{settings: settings}
		res, err := cfgProvider.GetSections(t.Context(), sections...)
		require.NoError(t, err)
		assert.Equal(t, metav1.LabelSelector{
			MatchExpressions: []metav1.LabelSelectorRequirement{
				{
					Key:      "section",
					Operator: metav1.LabelSelectorOpIn,
					Values:   sections,
				},
			},
		}, settings.selector)
		assert.Equal(t, iniFile, res)
		assert.Equal(t, 1, settings.calls)
	})

	t.Run("nil result becomes an empty ini", func(t *testing.T) {
		settings := &fakeIniLister{iniFile: nil}
		cfgProvider := &tenantConfigProvider{settings: settings}
		res, err := cfgProvider.GetSections(t.Context(), "auth")
		require.NoError(t, err)
		assert.Equal(t, ini.Empty(), res)
		assert.Equal(t, 1, settings.calls)
	})
}

func TestTenantConfigProvider_Get(t *testing.T) {
	t.Run("requests the right sections", func(t *testing.T) {
		settings := &fakeIniLister{}
		cfgProvider := &tenantConfigProvider{settings: settings}
		_, err := cfgProvider.Get(t.Context())
		require.NoError(t, err)
		assert.Equal(t, 1, settings.calls)
		assert.Equal(t, metav1.LabelSelector{
			MatchExpressions: []metav1.LabelSelectorRequirement{
				{
					Key:      "section",
					Operator: metav1.LabelSelectorOpIn,
					Values:   []string{"auth", "auth.ldap", "users"},
				},
			},
		}, settings.selector)
	})

	t.Run("fills login fields", func(t *testing.T) {
		iniFile := ini.Empty()

		auth, err := iniFile.NewSection("auth")
		require.NoError(t, err)
		_, err = auth.NewKey("disable_login_form", "true")
		require.NoError(t, err)

		authLDAP, err := iniFile.NewSection("auth.ldap")
		require.NoError(t, err)
		_, err = authLDAP.NewKey("enabled", "true")
		require.NoError(t, err)

		users, err := iniFile.NewSection("users")
		require.NoError(t, err)
		_, err = users.NewKey("login_hint", "a login hint")
		require.NoError(t, err)
		_, err = users.NewKey("password_hint", "a password hint")
		require.NoError(t, err)
		_, err = users.NewKey("allow_sign_up", "false")
		require.NoError(t, err)

		cfgProvider := &tenantConfigProvider{settings: &fakeIniLister{iniFile: iniFile}}
		cfg, err := cfgProvider.Get(t.Context())
		require.NoError(t, err)
		assert.True(t, cfg.DisableLoginForm)
		assert.True(t, cfg.LDAPAuthEnabled)
		assert.False(t, cfg.AllowUserSignUp)
		assert.Equal(t, "a login hint", cfg.LoginHint)
		assert.Equal(t, "a password hint", cfg.PasswordHint)
	})

	t.Run("propagates errors", func(t *testing.T) {
		errBoom := errors.New("boom")
		cfgProvider := &tenantConfigProvider{settings: &fakeIniLister{err: errBoom}}
		cfg, err := cfgProvider.Get(t.Context())
		require.ErrorIs(t, err, errBoom)
		assert.Nil(t, cfg)
	})
}
