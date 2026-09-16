package sso

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/log"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
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

type fakeWriter struct {
	upserts    map[string]string // section|key -> value
	namespaces map[string]bool   // namespaces resolved from the write context
}

func (f *fakeWriter) Upsert(ctx context.Context, s *settingsvc.Setting) error {
	f.upserts[s.Section+"|"+s.Key] = s.Value
	ns, _ := request.NamespaceFrom(ctx)
	f.namespaces[ns] = true
	return nil
}

func (f *fakeWriter) Delete(context.Context, string, string) error { return nil }

func newFakeWriter() *fakeWriter {
	return &fakeWriter{upserts: map[string]string{}, namespaces: map[string]bool{}}
}

func TestSSOSettingsBackfill(t *testing.T) {
	reader := &fakeStoredLister{settings: []*ssomodels.SSOSettings{
		{Provider: "github", Settings: map[string]any{"client_id": "abc", "client_secret": "topsecret"}},
		{Provider: "ldap", Settings: map[string]any{"config": map[string]any{"servers": []any{}}}},
	}}
	writer := newFakeWriter()
	b := &SSOSettingsBackfill{reader: reader, writer: writer, namespace: "stacks-11", log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))

	// The OAuth provider is copied per-key into its section.
	assert.Equal(t, "abc", writer.upserts["auth.github|client_id"])
	assert.Equal(t, "topsecret", writer.upserts["auth.github|client_secret"])
	// LDAP is skipped: MT-Settings has no representation for its nested config yet.
	assert.Len(t, writer.upserts, 2)
}

// TestSSOSettingsBackfill_WritesUnderConfiguredNamespace guards the namespace
// regression: the writer resolves the tenant from the context, and the backfill
// runs on a bare background context, so it must attach the configured namespace
// before writing. Without it every write lands under the empty namespace.
func TestSSOSettingsBackfill_WritesUnderConfiguredNamespace(t *testing.T) {
	reader := &fakeStoredLister{settings: []*ssomodels.SSOSettings{
		{Provider: "github", Settings: map[string]any{"client_id": "abc"}},
	}}
	writer := newFakeWriter()
	b := &SSOSettingsBackfill{reader: reader, writer: writer, namespace: "stacks-11", log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))

	assert.Equal(t, map[string]bool{"stacks-11": true}, writer.namespaces)
}

// Guards startup: no settings service -> disabled provider, not a wire error.
func TestProvideSSOSettingsBackfill_DisabledWithoutSettingsService(t *testing.T) {
	b, err := ProvideSSOSettingsBackfill(nil, nil, setting.NewCfg())

	require.NoError(t, err)
	require.NotNil(t, b)
	assert.Nil(t, b.writer)
	assert.True(t, b.IsDisabled())
}

func TestSSOSettingsBackfill_PropagatesReadError(t *testing.T) {
	reader := &fakeStoredLister{err: errors.New("boom")}
	b := &SSOSettingsBackfill{reader: reader, writer: newFakeWriter(), namespace: "stacks-11", log: log.New("test")}

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
	writer := newFakeWriter()
	b := &SSOSettingsBackfill{reader: reader, writer: writer, namespace: "stacks-11", log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))

	// Explicit values are preserved
	assert.Equal(t, "false", writer.upserts["auth.myProvider|setting_1"])
	assert.Equal(t, "email", writer.upserts["auth.myProvider|setting_2"])
	assert.Equal(t, "value", writer.upserts["auth.myProvider|setting_6"])
	// Absent or empty fields are backfilled with their default value
	assert.Equal(t, "mail", writer.upserts["auth.myProvider|setting_3"])
	assert.Equal(t, "default", writer.upserts["auth.myProvider|setting_4"])
	assert.Equal(t, "false", writer.upserts["auth.myProvider|setting_5"])
}

func TestSSOSettingsBackfill_NoDefaultsRegistered(t *testing.T) {
	// If the provider does not register any default values, only the explicit settings should
	// be backfilled.
	reader := &fakeStoredLister{settings: []*ssomodels.SSOSettings{
		{Provider: "myProvider", Settings: map[string]any{"setting_1": "value_1", "setting_2": "value_2"}},
	}}
	writer := newFakeWriter()
	b := &SSOSettingsBackfill{reader: reader, writer: writer, namespace: "stacks-11", log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))

	assert.Equal(t, "value_1", writer.upserts["auth.myProvider|setting_1"])
	assert.Equal(t, "value_2", writer.upserts["auth.myProvider|setting_2"])
	assert.Len(t, writer.upserts, 2)
}
