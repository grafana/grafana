package sso

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeConfigProvider struct {
	cfg   *setting.Cfg
	err   error
	calls int
}

func (f *fakeConfigProvider) Get(context.Context) (*setting.Cfg, error) {
	f.calls++
	return f.cfg, f.err
}

func (f *fakeConfigProvider) GetSections(context.Context, ...string) (*ini.File, error) {
	return ini.Empty(), nil
}

func TestLoginConfigHandler(t *testing.T) {
	errBoom := errors.New("boom")

	t.Run("maps config and enabled providers", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.DisableLoginForm = true
		cfg.AllowUserSignUp = false
		cfg.LoginHint = "user hint"
		cfg.PasswordHint = "pass hint"
		cfg.LDAPAuthEnabled = true

		fake := ssosettingstests.NewFakeService()
		fake.ExpectedSSOSettings = []*models.SSOSettings{
			{Provider: "generic_oauth", Settings: map[string]any{"enabled": true, "name": "OAuth", "icon": "signin", "client_secret": "topsecret"}},
			{Provider: "github", Settings: map[string]any{"enabled": false, "name": "GitHub", "icon": "github"}},
			{Provider: "ldap", Settings: map[string]any{"enabled": true}},
			{Provider: "saml", Settings: map[string]any{"enabled": "true", "name": "MySAML"}},
		}

		dto, err := NewLoginConfigHandler(mustConfigProvider(t, cfg), fake).build(t.Context())
		require.NoError(t, err)

		assert.True(t, dto.DisableLoginForm)
		assert.True(t, dto.DisableUserSignUp)
		assert.Equal(t, "user hint", dto.LoginHint)
		assert.Equal(t, "pass hint", dto.PasswordHint)
		assert.True(t, dto.LdapEnabled)
		assert.Equal(t, map[string]LoginOAuthProvider{"generic_oauth": {Name: "OAuth", Icon: "signin"}}, dto.OAuth)
		assert.True(t, dto.SamlEnabled)
		assert.Equal(t, "MySAML", dto.SamlName)

		raw, err := json.Marshal(dto)
		assert.NoError(t, err)
		assert.NotContains(t, string(raw), "topsecret", "DTO must never carry a secret")
	})

	t.Run("reads the config on every request", func(t *testing.T) {
		cfg := setting.NewCfg()
		provider := &fakeConfigProvider{cfg: cfg}
		h := NewLoginConfigHandler(provider, ssosettingstests.NewFakeService())

		dto, err := h.build(t.Context())
		require.NoError(t, err)
		assert.Empty(t, dto.LoginHint)

		cfg.LoginHint = "updated hint"
		dto, err = h.build(t.Context())
		require.NoError(t, err)
		assert.Equal(t, "updated hint", dto.LoginHint)
		assert.Equal(t, 2, provider.calls)
	})

	t.Run("build fails when the config read fails", func(t *testing.T) {
		h := NewLoginConfigHandler(&fakeConfigProvider{err: errBoom}, ssosettingstests.NewFakeService())

		_, err := h.build(t.Context())
		require.ErrorIs(t, err, errBoom)
	})

	t.Run("build fails when listing sso settings fails", func(t *testing.T) {
		fake := ssosettingstests.NewFakeService()
		fake.ExpectedError = errBoom
		h := NewLoginConfigHandler(&fakeConfigProvider{cfg: setting.NewCfg()}, fake)

		_, err := h.build(t.Context())
		require.ErrorIs(t, err, errBoom)
	})

	t.Run("handle responds 500 without leaking the cause", func(t *testing.T) {
		h := NewLoginConfigHandler(&fakeConfigProvider{err: errors.New("leak")}, ssosettingstests.NewFakeService())

		rec := httptest.NewRecorder()
		h.handle(rec, httptest.NewRequest(http.MethodGet, "/"+loginConfigPath, nil))

		assert.Equal(t, http.StatusInternalServerError, rec.Code)
		assert.NotContains(t, rec.Body.String(), "leak")
	})
}

func TestTruthy(t *testing.T) {
	tests := []struct {
		in   any
		want bool
	}{
		{true, true},
		{false, false},
		{"true", true},
		{"false", false},
		{"1", true},
		{"0", false},
		{"yes", false}, // not parseable -> false
		{"", false},
		{int64(1), false}, // non-string -> false
		{nil, false},
	}
	for _, tc := range tests {
		assert.Equalf(t, tc.want, truthy(tc.in), "truthy(%#v)", tc.in)
	}
}

func mustConfigProvider(t *testing.T, cfg *setting.Cfg) configprovider.ConfigProvider {
	t.Helper()
	provider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	return provider
}
