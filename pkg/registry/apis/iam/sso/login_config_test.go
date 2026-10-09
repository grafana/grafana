package sso

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"

	legacyiamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/setting"
)

func TestLoginConfigHandler_Build(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.DisableLoginForm = true
	cfg.AllowUserSignUp = false
	cfg.LoginHint = "user hint"
	cfg.PasswordHint = "pass hint"
	cfg.LDAPAuthEnabled = true

	fake := ssosettingstests.NewFakeService()
	fake.ExpectedSSOSettings = []*models.SSOSettings{
		// enabled OAuth provider: included with name/icon; its secret must not appear in the DTO.
		{Provider: "generic_oauth", Settings: map[string]any{"enabled": true, "name": "OAuth", "icon": "signin", "client_secret": "topsecret"}},
		// disabled OAuth provider: excluded.
		{Provider: "github", Settings: map[string]any{"enabled": false, "name": "GitHub", "icon": "github"}},
		// LDAP: never in the oauth map (handled via cfg.ldapEnabled).
		{Provider: "ldap", Settings: map[string]any{"enabled": true}},
		// SAML: enabled arrives as the MT string "true".
		{Provider: "saml", Settings: map[string]any{"enabled": "true", "name": "MySAML"}},
	}

	dto := NewLoginConfigHandler(cfg, fake).build(context.Background())

	assert.True(t, dto.DisableLoginForm)
	assert.True(t, dto.DisableUserSignUp) // !AllowUserSignUp
	assert.Equal(t, "user hint", dto.LoginHint)
	assert.Equal(t, "pass hint", dto.PasswordHint)
	assert.True(t, dto.LdapEnabled)
	assert.Equal(t, map[string]LoginOAuthProvider{"generic_oauth": {Name: "OAuth", Icon: "signin"}}, dto.OAuth)
	assert.True(t, dto.SamlEnabled)
	assert.Equal(t, "MySAML", dto.SamlName)

	raw, err := json.Marshal(dto)
	assert.NoError(t, err)
	assert.NotContains(t, string(raw), "topsecret", "DTO must never carry a secret")
}

func TestLoginConfigHandler_BuildGracefulOnListError(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.DisableLoginForm = true

	fake := ssosettingstests.NewFakeService()
	fake.ExpectedError = errors.New("boom")

	dto := NewLoginConfigHandler(cfg, fake).build(context.Background())

	// cfg-derived fields still served; provider read failed cleanly.
	assert.True(t, dto.DisableLoginForm)
	assert.Empty(t, dto.OAuth)
	assert.False(t, dto.SamlEnabled)
}

func TestLoginConfigHandler_Source(t *testing.T) {
	key := legacyiamv0.SSOSettingResourceInfo.GroupResource().String()
	tests := []struct {
		name string
		mode *grafanarest.DualWriterMode
		want string
	}{
		{"unset", nil, "database"},
		{"mode 0", new(grafanarest.Mode0), "database"},
		{"mode 2", new(grafanarest.Mode2), "database"},
		{"mode 3", new(grafanarest.Mode3), "mt-settings"},
		{"mode 5", new(grafanarest.Mode5), "mt-settings"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			if tc.mode != nil {
				cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
					key: {DualWriterMode: *tc.mode},
				}
			}
			h := NewLoginConfigHandler(cfg, ssosettingstests.NewFakeService())
			assert.Equal(t, tc.want, h.source())
		})
	}
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
