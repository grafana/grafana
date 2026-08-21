package sso

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	ssomodels "github.com/grafana/grafana/pkg/services/ssosettings/models"
)

type fakeStoredLister struct {
	settings []*ssomodels.SSOSettings
	err      error
}

func (f *fakeStoredLister) ListStored(context.Context) ([]*ssomodels.SSOSettings, error) {
	return f.settings, f.err
}

type fakeWriter struct {
	upserts map[string]string // section|key -> value
}

func (f *fakeWriter) Upsert(_ context.Context, s *settingsvc.Setting) error {
	f.upserts[s.Section+"|"+s.Key] = s.Value
	return nil
}

func (f *fakeWriter) Delete(context.Context, string, string) error { return nil }

func TestSSOSettingsBackfill(t *testing.T) {
	reader := &fakeStoredLister{settings: []*ssomodels.SSOSettings{
		{Provider: "github", Settings: map[string]any{"client_id": "abc", "client_secret": "topsecret"}},
		{Provider: "ldap", Settings: map[string]any{"config": map[string]any{"servers": []any{}}}},
	}}
	writer := &fakeWriter{upserts: map[string]string{}}
	b := &SSOSettingsBackfill{reader: reader, writer: writer, log: log.New("test")}

	require.NoError(t, b.backfill(context.Background()))

	// The OAuth provider is copied per-key into its section.
	assert.Equal(t, "abc", writer.upserts["auth.github|client_id"])
	assert.Equal(t, "topsecret", writer.upserts["auth.github|client_secret"])
	// LDAP is skipped: MT-Settings has no representation for its nested config yet.
	assert.Len(t, writer.upserts, 2)
}

func TestSSOSettingsBackfill_PropagatesReadError(t *testing.T) {
	reader := &fakeStoredLister{err: errors.New("boom")}
	b := &SSOSettingsBackfill{reader: reader, writer: &fakeWriter{upserts: map[string]string{}}, log: log.New("test")}

	require.Error(t, b.backfill(context.Background()))
}
