package ssosettingsimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/services/ssosettings/strategies"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeReadStore struct {
	getFn  func(ctx context.Context, provider string) (*models.SSOSettings, error)
	listFn func(ctx context.Context) ([]*models.SSOSettings, error)
}

func (f *fakeReadStore) Get(ctx context.Context, provider string) (*models.SSOSettings, error) {
	return f.getFn(ctx, provider)
}
func (f *fakeReadStore) List(ctx context.Context) ([]*models.SSOSettings, error) {
	return f.listFn(ctx)
}
func (f *fakeReadStore) Upsert(context.Context, *models.SSOSettings) error { return nil }
func (f *fakeReadStore) Delete(context.Context, string) error              { return nil }

func storeWith(rows ...*models.SSOSettings) *fakeReadStore {
	return &fakeReadStore{
		getFn: func(_ context.Context, provider string) (*models.SSOSettings, error) {
			if row := getSettingByProvider(provider, rows); row != nil {
				return row, nil
			}
			return nil, ssosettings.ErrNotFound
		},
		listFn: func(context.Context) ([]*models.SSOSettings, error) {
			return rows, nil
		},
	}
}

func fallbackWith(configs map[string]map[string]any) *ssosettingstests.FakeFallbackStrategy {
	return &ssosettingstests.FakeFallbackStrategy{ExpectedConfigs: configs}
}

func TestReadOnlyDBService_List(t *testing.T) {
	t.Run("without fallback serves stored rows redacted", func(t *testing.T) {
		svc := &readOnlyDBService{store: storeWith(&models.SSOSettings{Provider: "github", Settings: map[string]any{
			"client_id":     "the-id",
			"client_secret": "top-secret",
		}})}

		got, err := svc.List(t.Context())
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, "the-id", got[0].Settings["client_id"])
		assert.Equal(t, setting.RedactedPassword, got[0].Settings["client_secret"])
	})

	t.Run("serves fallback-only providers as system", func(t *testing.T) {
		svc := &readOnlyDBService{
			store:    storeWith(),
			fallback: fallbackWith(map[string]map[string]any{"github": {"client_id": "from-config"}}),
		}

		got, err := svc.List(t.Context())
		require.NoError(t, err)
		assert.Len(t, got, len(ssosettings.AllOAuthProviders))
		github := getSettingByProvider("github", got)
		require.NotNil(t, github)
		assert.EqualValues(t, models.System, github.Source)
		assert.Equal(t, "from-config", github.Settings["client_id"])
	})

	t.Run("merges stored rows over the fallback", func(t *testing.T) {
		svc := &readOnlyDBService{
			store: storeWith(&models.SSOSettings{Provider: "github", Source: models.DB, Settings: map[string]any{
				"client_id": "from-db",
			}}),
			fallback: fallbackWith(map[string]map[string]any{"github": {
				"client_id": "from-config",
				"scopes":    "user:email",
			}}),
		}

		got, err := svc.List(t.Context())
		require.NoError(t, err)
		github := getSettingByProvider("github", got)
		require.NotNil(t, github)
		assert.EqualValues(t, models.DB, github.Source)
		assert.Equal(t, "from-db", github.Settings["client_id"])
		assert.Equal(t, "user:email", github.Settings["scopes"])
	})

	t.Run("does not merge forbidden keys from the fallback", func(t *testing.T) {
		svc := &readOnlyDBService{
			store: storeWith(&models.SSOSettings{Provider: "github", Settings: map[string]any{"client_id": "from-db"}}),
			fallback: fallbackWith(map[string]map[string]any{"github": {
				"tls_client_cert_certificate": "from-config",
			}}),
		}

		got, err := svc.List(t.Context())
		require.NoError(t, err)
		github := getSettingByProvider("github", got)
		require.NotNil(t, github)
		assert.NotContains(t, github.Settings, "tls_client_cert_certificate")
	})

	t.Run("redacts secrets coming from the fallback", func(t *testing.T) {
		svc := &readOnlyDBService{
			store: storeWith(&models.SSOSettings{Provider: "gitlab", Settings: map[string]any{"client_id": "from-db"}}),
			fallback: fallbackWith(map[string]map[string]any{
				"github": {"client_secret": "config-only"},
				"gitlab": {"client_secret": "merged-in"},
			}),
		}

		got, err := svc.List(t.Context())
		require.NoError(t, err)
		assert.Equal(t, setting.RedactedPassword, getSettingByProvider("github", got).Settings["client_secret"])
		assert.Equal(t, setting.RedactedPassword, getSettingByProvider("gitlab", got).Settings["client_secret"])
	})

	t.Run("keeps non-OAuth stored rows", func(t *testing.T) {
		svc := &readOnlyDBService{
			store: storeWith(&models.SSOSettings{Provider: social.SAMLProviderName, Settings: map[string]any{
				"private_key": "top-secret",
			}}),
			fallback: fallbackWith(nil),
		}

		got, err := svc.List(t.Context())
		require.NoError(t, err)
		assert.Len(t, got, len(ssosettings.AllOAuthProviders)+1)
		saml := getSettingByProvider(social.SAMLProviderName, got)
		require.NotNil(t, saml)
		assert.Equal(t, setting.RedactedPassword, saml.Settings["private_key"])
	})

	t.Run("propagates fallback errors", func(t *testing.T) {
		errBoom := errors.New("boom")
		svc := &readOnlyDBService{
			store:    storeWith(),
			fallback: &ssosettingstests.FakeFallbackStrategy{ExpectedError: errBoom},
		}

		_, err := svc.List(t.Context())
		require.ErrorIs(t, err, errBoom)
	})

	t.Run("serves the legacy grafananet section only as grafana_com", func(t *testing.T) {
		iniFile, err := ini.Load([]byte(`
[auth.grafananet]
enabled = true
client_id = legacy
`))
		require.NoError(t, err)
		cfg := setting.NewCfg()
		cfg.Raw = iniFile

		svc := &readOnlyDBService{
			store:    storeWith(),
			fallback: strategies.NewOAuthStrategy(mustConfigProvider(t, cfg)),
		}

		got, err := svc.List(t.Context())
		require.NoError(t, err)
		assert.Nil(t, getSettingByProvider(social.GrafanaNetProviderName, got))
		grafanaCom := getSettingByProvider(social.GrafanaComProviderName, got)
		require.NotNil(t, grafanaCom)
		assert.Equal(t, "legacy", grafanaCom.Settings["client_id"])
	})
}

func TestReadOnlyDBService_GetForProviderWithRedactedSecrets(t *testing.T) {
	t.Run("without fallback serves the stored row redacted", func(t *testing.T) {
		svc := &readOnlyDBService{store: storeWith(&models.SSOSettings{Provider: "github", Settings: map[string]any{
			"client_id":     "the-id",
			"client_secret": "top-secret",
		}})}

		got, err := svc.GetForProviderWithRedactedSecrets(t.Context(), "github")
		require.NoError(t, err)
		assert.Equal(t, "the-id", got.Settings["client_id"])
		assert.Equal(t, setting.RedactedPassword, got.Settings["client_secret"])
	})

	t.Run("without fallback propagates not found", func(t *testing.T) {
		svc := &readOnlyDBService{store: storeWith()}

		_, err := svc.GetForProviderWithRedactedSecrets(t.Context(), "github")
		require.ErrorIs(t, err, ssosettings.ErrNotFound)
	})

	t.Run("serves a missing row from the fallback", func(t *testing.T) {
		svc := &readOnlyDBService{
			store: storeWith(),
			fallback: fallbackWith(map[string]map[string]any{"github": {
				"client_id":     "from-config",
				"client_secret": "config-only",
			}}),
		}

		got, err := svc.GetForProviderWithRedactedSecrets(t.Context(), "github")
		require.NoError(t, err)
		assert.EqualValues(t, models.System, got.Source)
		assert.Equal(t, "from-config", got.Settings["client_id"])
		assert.Equal(t, setting.RedactedPassword, got.Settings["client_secret"])
	})

	t.Run("merges the stored row over the fallback", func(t *testing.T) {
		svc := &readOnlyDBService{
			store: storeWith(&models.SSOSettings{Provider: "github", Source: models.DB, Settings: map[string]any{
				"client_id": "from-db",
			}}),
			fallback: fallbackWith(map[string]map[string]any{"github": {
				"client_id": "from-config",
				"scopes":    "user:email",
			}}),
		}

		got, err := svc.GetForProviderWithRedactedSecrets(t.Context(), "github")
		require.NoError(t, err)
		assert.EqualValues(t, models.DB, got.Source)
		assert.Equal(t, "from-db", got.Settings["client_id"])
		assert.Equal(t, "user:email", got.Settings["scopes"])
	})

	t.Run("does not use the fallback for non-OAuth providers", func(t *testing.T) {
		svc := &readOnlyDBService{
			store:    storeWith(),
			fallback: fallbackWith(map[string]map[string]any{social.SAMLProviderName: {"enabled": true}}),
		}

		_, err := svc.GetForProviderWithRedactedSecrets(t.Context(), social.SAMLProviderName)
		require.ErrorIs(t, err, ssosettings.ErrNotFound)
	})

	t.Run("does not serve the legacy grafananet alias", func(t *testing.T) {
		iniFile, err := ini.Load([]byte(`
[auth.grafananet]
enabled = true
client_id = legacy
`))
		require.NoError(t, err)
		cfg := setting.NewCfg()
		cfg.Raw = iniFile

		svc := &readOnlyDBService{
			store:    storeWith(),
			fallback: strategies.NewOAuthStrategy(mustConfigProvider(t, cfg)),
		}

		_, err = svc.GetForProviderWithRedactedSecrets(t.Context(), social.GrafanaNetProviderName)
		require.ErrorIs(t, err, ssosettings.ErrNotFound)
	})

	t.Run("propagates store errors other than not found", func(t *testing.T) {
		errBoom := errors.New("boom")
		svc := &readOnlyDBService{
			store: &fakeReadStore{getFn: func(context.Context, string) (*models.SSOSettings, error) {
				return nil, errBoom
			}},
			fallback: fallbackWith(nil),
		}

		_, err := svc.GetForProviderWithRedactedSecrets(t.Context(), "github")
		require.ErrorIs(t, err, errBoom)
	})

	t.Run("propagates fallback errors", func(t *testing.T) {
		errBoom := errors.New("boom")
		svc := &readOnlyDBService{
			store:    storeWith(),
			fallback: &ssosettingstests.FakeFallbackStrategy{ExpectedError: errBoom},
		}

		_, err := svc.GetForProviderWithRedactedSecrets(t.Context(), "github")
		require.ErrorIs(t, err, errBoom)
	})
}

func TestReadOnlyDBService_WritesUnsupported(t *testing.T) {
	svc := &readOnlyDBService{}
	ctx := t.Context()

	// Writes must map to 405 Method Not Allowed, not a generic 500.
	assert.True(t, apierrors.IsMethodNotSupported(svc.Upsert(ctx, &models.SSOSettings{}, identity.Requester(nil))))
	assert.True(t, apierrors.IsMethodNotSupported(svc.Delete(ctx, "github")))
	assert.True(t, apierrors.IsMethodNotSupported(svc.Patch(ctx, "github", nil, identity.Requester(nil))))

	_, err := svc.GetForProvider(ctx, "github")
	assert.True(t, apierrors.IsMethodNotSupported(err))
}
