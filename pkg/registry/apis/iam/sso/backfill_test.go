package sso

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ssomodels "github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeStoredLister struct {
	settings []*ssomodels.SSOSettings
	err      error
	defaults map[string]map[string]any
}

func (f *fakeStoredLister) ListStored(context.Context) ([]*ssomodels.SSOSettings, error) {
	return f.settings, f.err
}

func (f *fakeStoredLister) GetDefaults(provider string) map[string]any {
	return f.defaults[provider]
}

func TestSSOSettingsBackfill(t *testing.T) {
	reader := &fakeStoredLister{settings: []*ssomodels.SSOSettings{
		{Provider: "github", Settings: map[string]any{"client_id": "abc", "client_secret": "topsecret"}},
		{Provider: "ldap", Settings: map[string]any{"config": map[string]any{"servers": []any{}}}},
	}}
	mt := newFakeSettings()
	b := &SSOSettingsBackfill{legacyReader: reader, mtReader: mt, mtWriter: mt, namespace: "stacks-11", log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))

	// The OAuth provider is copied per-key into its section.
	assert.Equal(t, "abc", mt.upserts["auth.github|client_id"])
	assert.Equal(t, "topsecret", mt.upserts["auth.github|client_secret"])
	// LDAP is skipped: MT-Settings has no representation for its nested config yet.
	assert.Len(t, mt.upserts, 2)
}

// TestSSOSettingsBackfill_WritesUnderConfiguredNamespace guards the namespace
// regression: the writer resolves the tenant from the context, and the backfill
// runs on a bare background context, so it must attach the configured namespace
// before writing. Without it every write lands under the empty namespace.
func TestSSOSettingsBackfill_WritesUnderConfiguredNamespace(t *testing.T) {
	reader := &fakeStoredLister{settings: []*ssomodels.SSOSettings{
		{Provider: "github", Settings: map[string]any{"client_id": "abc"}},
	}}
	mt := newFakeSettings()
	b := &SSOSettingsBackfill{legacyReader: reader, mtReader: mt, mtWriter: mt, namespace: "stacks-11", log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))

	assert.Equal(t, map[string]bool{"stacks-11": true}, mt.namespaces)
}

// Guards startup: no settings service -> disabled provider, not a wire error.
func TestProvideSSOSettingsBackfill_DisabledWithoutSettingsService(t *testing.T) {
	b, err := ProvideSSOSettingsBackfill(nil, nil, setting.NewCfg())

	require.NoError(t, err)
	require.NotNil(t, b)
	assert.Nil(t, b.mtWriter)
	assert.True(t, b.IsDisabled())
}

func TestSSOSettingsBackfill_IsDisabledByMode(t *testing.T) {
	provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagGrafanaSsoSettingsToMTSettings: {
			State:          memprovider.Enabled,
			DefaultVariant: "on",
			Variants:       map[string]any{"on": true, "off": false},
		},
	})
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { _ = openfeature.SetProviderAndWait(openfeature.NoopProvider{}) })

	tests := []struct {
		mode     grafanarest.DualWriterMode
		disabled bool
	}{
		{grafanarest.Mode0, false},
		{grafanarest.Mode3, false},
		{grafanarest.Mode4, true},
		{grafanarest.Mode5, true},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("mode %d", tt.mode), func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				resource.GroupResource().String(): {DualWriterMode: tt.mode},
			}
			b := &SSOSettingsBackfill{mtWriter: newFakeSettings(), cfg: cfg, log: log.New("test")}

			assert.Equal(t, tt.disabled, b.IsDisabled())
		})
	}
}

func TestSSOSettingsBackfill_PropagatesReadError(t *testing.T) {
	reader := &fakeStoredLister{err: errors.New("boom")}
	b := &SSOSettingsBackfill{legacyReader: reader, mtWriter: newFakeSettings(), namespace: "stacks-11", log: log.New("test")}

	require.Error(t, b.backfill(context.Background()))
}

func TestSSOSettingsBackfill_Defaults(t *testing.T) {
	reader := &fakeStoredLister{
		settings: []*ssomodels.SSOSettings{
			{Provider: "myProvider", Settings: map[string]any{
				// Overrides of fields with default values
				"setting_1": false,
				"setting_2": "email",
				// Empty fields should be overridden by default value
				"setting_4": "",
				// Should be passed through unchanged.
				"setting_6": "value",
			}},
		},
		defaults: map[string]map[string]any{
			"myProvider": {
				"setting_1": true,
				"setting_2": "mail",
				"setting_3": "mail",
				"setting_4": "default",
				"setting_5": false,
			},
		},
	}
	mt := newFakeSettings()
	b := &SSOSettingsBackfill{legacyReader: reader, mtReader: mt, mtWriter: mt, namespace: "stacks-11", log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))

	// Explicit values are preserved
	assert.Equal(t, "false", mt.upserts["auth.myProvider|setting_1"])
	assert.Equal(t, "email", mt.upserts["auth.myProvider|setting_2"])
	assert.Equal(t, "value", mt.upserts["auth.myProvider|setting_6"])
	// Absent or empty fields are backfilled with their default value
	assert.Equal(t, "mail", mt.upserts["auth.myProvider|setting_3"])
	assert.Equal(t, "default", mt.upserts["auth.myProvider|setting_4"])
	assert.Equal(t, "false", mt.upserts["auth.myProvider|setting_5"])
}

func TestSSOSettingsBackfill_PrunesStaleRows(t *testing.T) {
	reader := &fakeStoredLister{
		settings: []*ssomodels.SSOSettings{
			{Provider: "myProvider", Settings: map[string]any{"client_id": "abc"}},
		},
		defaults: map[string]map[string]any{
			"myProvider": {"providerDefaultSetting_1": "default_1"},
		},
	}
	mt := newFakeSettings(
		usRow("auth.myProvider", "client_id", "stale"),
		usRow("auth.myProvider", "removed_key", "x"),
		usRow("auth.myProvider", "providerDefaultSetting_1", "default_1"),
		defaultRow("auth.myProvider", "from_defaults", "y"),
		usRow("auth.okta", "client_id", "z"),
	)
	b := &SSOSettingsBackfill{legacyReader: reader, mtReader: mt, mtWriter: mt, namespace: "stacks-11", log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))

	assert.Equal(t, []string{"auth.github|removed_key"}, mt.deleted)
	assert.Equal(t, "abc", mt.upserts["auth.github|client_id"])
	assert.Equal(t, "default_1", mt.upserts["auth.myProvider|providerDefaultSetting_1"])
}

func TestSSOSettingsBackfill_Converges(t *testing.T) {
	reader := &fakeStoredLister{settings: []*ssomodels.SSOSettings{
		{Provider: "github", Settings: map[string]any{"client_id": "abc"}},
	}}
	mt := newFakeSettings(usRow("auth.github", "removed_key", "x"))
	b := &SSOSettingsBackfill{legacyReader: reader, mtReader: mt, mtWriter: mt, namespace: "stacks-11", log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))
	require.Equal(t, []string{"auth.github|removed_key"}, mt.deleted)

	// A second pass should be a no-op
	require.NoError(t, b.backfill(context.Background()))
	assert.Equal(t, []string{"auth.github|removed_key"}, mt.deleted)
}

func TestSSOSettingsBackfill_PropagatesPruneError(t *testing.T) {
	reader := &fakeStoredLister{settings: []*ssomodels.SSOSettings{
		{Provider: "github", Settings: map[string]any{"client_id": "abc"}},
	}}
	mt := newFakeSettings()
	mt.listErr = errors.New("boom")
	b := &SSOSettingsBackfill{legacyReader: reader, mtReader: mt, mtWriter: mt, namespace: "stacks-11", log: log.New("test")}

	require.Error(t, b.backfill(context.Background()))
}

func TestSSOSettingsBackfill_NoDefaultsRegistered(t *testing.T) {
	// If the provider does not register any default values, only the explicit settings should
	// be backfilled.
	reader := &fakeStoredLister{settings: []*ssomodels.SSOSettings{
		{Provider: "myProvider", Settings: map[string]any{"setting_1": "value_1", "setting_2": "value_2"}},
	}}
	mt := newFakeSettings()
	b := &SSOSettingsBackfill{legacyReader: reader, mtReader: mt, mtWriter: mt, namespace: "stacks-11", log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))

	assert.Equal(t, "value_1", mt.upserts["auth.myProvider|setting_1"])
	assert.Equal(t, "value_2", mt.upserts["auth.myProvider|setting_2"])
	assert.Len(t, mt.upserts, 2)
}
