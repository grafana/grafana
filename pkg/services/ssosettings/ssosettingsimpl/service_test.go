package ssosettingsimpl

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	secretsFakes "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSSOSettingsService_GetForProvider(t *testing.T) {
	testCases := []struct {
		name    string
		setup   func(env testEnv)
		want    *models.SSOSettings
		wantErr bool
	}{
		{
			name: "should return successfully",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSetting = &models.SSOSettings{
					Provider: "github",
					Settings: map[string]any{"enabled": true},
					Source:   models.DB,
				}
			},
			want: &models.SSOSettings{
				Provider: "github",
				Settings: map[string]any{"enabled": true},
			},
			wantErr: false,
		},
		{
			name:    "should return error if store returns an error different than not found",
			setup:   func(env testEnv) { env.store.ExpectedError = fmt.Errorf("error") },
			want:    nil,
			wantErr: true,
		},
		{
			name: "should fallback to strategy if store returns not found",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfig = map[string]any{"enabled": true}
			},
			want: &models.SSOSettings{
				Provider: "github",
				Settings: map[string]any{"enabled": true},
				Source:   models.System,
			},
			wantErr: false,
		},
		{
			name: "should return error if the fallback strategy was not found",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = false
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "should return error if fallback strategy returns error",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedError = fmt.Errorf("error")
			},
			want:    nil,
			wantErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			env := setupTestEnv(t)
			if tc.setup != nil {
				tc.setup(env)
			}

			actual, err := env.service.GetForProvider(context.Background(), "github")

			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.want, actual)
		})
	}
}

func TestSSOSettingsService_GetForProviderWithRedactedSecrets(t *testing.T) {
	testCases := []struct {
		name    string
		setup   func(env testEnv)
		want    *models.SSOSettings
		wantErr bool
	}{
		{
			name: "should return successfully and redact secrets",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSetting = &models.SSOSettings{
					Provider: "github",
					Settings: map[string]any{
						"enabled":       true,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					Source: models.DB,
				}
			},
			want: &models.SSOSettings{
				Provider: "github",
				Settings: map[string]any{
					"enabled":       true,
					"secret":        "*********",
					"client_secret": "*********",
					"client_id":     "client_id",
				},
			},
			wantErr: false,
		},
		{
			name:    "should return error if store returns an error different than not found",
			setup:   func(env testEnv) { env.store.ExpectedError = fmt.Errorf("error") },
			want:    nil,
			wantErr: true,
		},
		{
			name: "should fallback to strategy if store returns not found",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfig = map[string]any{"enabled": true}
			},
			want: &models.SSOSettings{
				Provider: "github",
				Settings: map[string]any{"enabled": true},
				Source:   models.System,
			},
			wantErr: false,
		},
		{
			name: "should return error if the fallback strategy was not found",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = false
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "should return error if fallback strategy returns error",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedError = fmt.Errorf("error")
			},
			want:    nil,
			wantErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			env := setupTestEnv(t)
			if tc.setup != nil {
				tc.setup(env)
			}

			actual, err := env.service.GetForProviderWithRedactedSecrets(context.Background(), "github")

			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.want, actual)
		})
	}
}

func TestSSOSettingsService_List(t *testing.T) {
	testCases := []struct {
		name    string
		setup   func(env testEnv)
		want    []*models.SSOSettings
		wantErr bool
	}{
		{
			name: "should return successfully",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSettings = []*models.SSOSettings{
					{
						Provider: "github",
						Settings: map[string]any{"enabled": true},
						Source:   models.DB,
					},
					{
						Provider: "okta",
						Settings: map[string]any{"enabled": false},
						Source:   models.DB,
					},
				}
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfig = map[string]any{"enabled": false}
			},
			want: []*models.SSOSettings{
				{
					Provider: "github",
					Settings: map[string]any{"enabled": true},
					Source:   models.DB,
				},
				{
					Provider: "okta",
					Settings: map[string]any{"enabled": false},
					Source:   models.DB,
				},
				{
					Provider: "gitlab",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
				{
					Provider: "generic_oauth",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
				{
					Provider: "google",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
				{
					Provider: "azuread",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
				{
					Provider: "grafana_com",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
			},
			wantErr: false,
		},
		{
			name:    "should return error if store returns an error",
			setup:   func(env testEnv) { env.store.ExpectedError = fmt.Errorf("error") },
			want:    nil,
			wantErr: true,
		},
		{
			name: "should use the fallback strategy if store returns empty list",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSettings = []*models.SSOSettings{}
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfig = map[string]any{"enabled": false}
			},
			want: []*models.SSOSettings{
				{
					Provider: "github",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
				{
					Provider: "okta",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
				{
					Provider: "gitlab",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
				{
					Provider: "generic_oauth",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
				{
					Provider: "google",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
				{
					Provider: "azuread",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
				{
					Provider: "grafana_com",
					Settings: map[string]any{"enabled": false},
					Source:   models.System,
				},
			},
			wantErr: false,
		},
		{
			name: "should return error if any of the fallback strategies was not found",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSettings = []*models.SSOSettings{}
				env.fallbackStrategy.ExpectedIsMatch = false
			},
			want:    nil,
			wantErr: true,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			env := setupTestEnv(t)
			if tc.setup != nil {
				tc.setup(env)
			}

			actual, err := env.service.List(context.Background())

			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.ElementsMatch(t, tc.want, actual)
		})
	}
}

func TestSSOSettingsService_Upsert(t *testing.T) {
	t.Run("successfully upsert SSO settings", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.AzureADProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, settings).Return(nil)
		reloadable.On("Reload", mock.Anything, mock.Anything).Return(nil).Maybe()
		env.reloadables[provider] = reloadable
		env.secrets.On("Encrypt", mock.Anything, []byte(settings.Settings["client_secret"].(string)), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()

		err := env.service.Upsert(context.Background(), settings)
		require.NoError(t, err)

		settings.Settings["client_secret"] = "encrypted-client-secret"
		require.EqualValues(t, settings, env.store.ActualSSOSettings)
	})

	t.Run("successfully upsert SSO settings having system settings", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.GitHubProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}
		systemSettings := map[string]any{
			"api_url":           "http://api-url",
			"use_refresh_token": true,
		}

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, settings).Return(nil)
		reloadable.On("Reload", mock.Anything, mock.Anything).Return(nil).Maybe()
		env.reloadables[provider] = reloadable
		env.fallbackStrategy.ExpectedConfig = systemSettings
		env.secrets.On("Encrypt", mock.Anything, []byte(settings.Settings["client_secret"].(string)), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()

		err := env.service.Upsert(context.Background(), settings)
		require.NoError(t, err)

		settings.Settings["client_secret"] = "encrypted-client-secret"
		settings.Settings["api_url"] = systemSettings["api_url"]
		settings.Settings["use_refresh_token"] = systemSettings["use_refresh_token"]
		require.EqualValues(t, settings, env.store.ActualSSOSettings)
	})

	t.Run("successfully upsert SSO settings having system settings without overwriting user settings", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.GitlabProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}
		systemSettings := map[string]any{
			"client_id":         "client-id-from-system",
			"client_secret":     "client-secret-from-system",
			"enabled":           false,
			"api_url":           "http://api-url",
			"use_refresh_token": true,
		}

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, settings).Return(nil)
		reloadable.On("Reload", mock.Anything, mock.Anything).Return(nil).Maybe()
		env.reloadables[provider] = reloadable
		env.fallbackStrategy.ExpectedConfig = systemSettings
		env.secrets.On("Encrypt", mock.Anything, []byte(settings.Settings["client_secret"].(string)), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()

		err := env.service.Upsert(context.Background(), settings)
		require.NoError(t, err)

		settings.Settings["client_secret"] = "encrypted-client-secret"
		settings.Settings["api_url"] = systemSettings["api_url"]
		settings.Settings["use_refresh_token"] = systemSettings["use_refresh_token"]
		require.EqualValues(t, settings, env.store.ActualSSOSettings)
	})

	t.Run("returns error if provider is not configurable", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.GrafanaComProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}

		reloadable := ssosettingstests.NewMockReloadable(t)
		env.reloadables[provider] = reloadable

		err := env.service.Upsert(context.Background(), settings)
		require.Error(t, err)
	})

	t.Run("returns error if provider was not found in reloadables", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.AzureADProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}

		reloadable := ssosettingstests.NewMockReloadable(t)
		// the reloadable is available for other provider
		env.reloadables["github"] = reloadable

		err := env.service.Upsert(context.Background(), settings)
		require.Error(t, err)
	})

	t.Run("returns error if validation fails", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.AzureADProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, settings).Return(errors.New("validation failed"))
		env.reloadables[provider] = reloadable

		err := env.service.Upsert(context.Background(), settings)
		require.Error(t, err)
	})

	t.Run("returns error if a fallback strategy is not available for the provider", func(t *testing.T) {
		env := setupTestEnv(t)

		settings := models.SSOSettings{
			Provider: social.AzureADProviderName,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}

		env.fallbackStrategy.ExpectedIsMatch = false

		err := env.service.Upsert(context.Background(), settings)
		require.Error(t, err)
	})

	t.Run("returns error if secrets encryption failed", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.OktaProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, settings).Return(nil)
		env.reloadables[provider] = reloadable
		env.secrets.On("Encrypt", mock.Anything, []byte(settings.Settings["client_secret"].(string)), mock.Anything).Return(nil, errors.New("encryption failed")).Once()

		err := env.service.Upsert(context.Background(), settings)
		require.Error(t, err)
	})

	t.Run("returns error if store failed to upsert settings", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.AzureADProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, settings).Return(nil)
		env.reloadables[provider] = reloadable
		env.secrets.On("Encrypt", mock.Anything, []byte(settings.Settings["client_secret"].(string)), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()
		env.store.ExpectedError = errors.New("upsert failed")

		err := env.service.Upsert(context.Background(), settings)
		require.Error(t, err)
	})

	t.Run("successfully upsert SSO settings if reload fails", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.AzureADProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, settings).Return(nil)
		reloadable.On("Reload", mock.Anything, mock.Anything).Return(errors.New("failed reloading new settings")).Maybe()
		env.reloadables[provider] = reloadable
		env.secrets.On("Encrypt", mock.Anything, []byte(settings.Settings["client_secret"].(string)), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()

		err := env.service.Upsert(context.Background(), settings)
		require.NoError(t, err)

		settings.Settings["client_secret"] = "encrypted-client-secret"
		require.EqualValues(t, settings, env.store.ActualSSOSettings)
	})
}

func TestSSOSettingsService_Delete(t *testing.T) {
	t.Run("successfully delete SSO settings", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.AzureADProviderName
		env.store.ExpectedError = nil

		err := env.service.Delete(context.Background(), provider)
		require.NoError(t, err)
	})

	t.Run("SSO settings not found for the specified provider", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.AzureADProviderName
		env.store.ExpectedError = ssosettings.ErrNotFound

		err := env.service.Delete(context.Background(), provider)
		require.Error(t, err)
		require.ErrorIs(t, err, ssosettings.ErrNotFound)
	})

	t.Run("store fails to delete the SSO settings for the specified provider", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := social.AzureADProviderName
		env.store.ExpectedError = errors.New("delete sso settings failed")

		err := env.service.Delete(context.Background(), provider)
		require.Error(t, err)
		require.NotErrorIs(t, err, ssosettings.ErrNotFound)
	})
}

func TestSSOSettingsService_DoReload(t *testing.T) {
	t.Run("successfully reload settings", func(t *testing.T) {
		env := setupTestEnv(t)

		settingsList := []*models.SSOSettings{
			{
				Provider: "github",
				Settings: map[string]any{
					"enabled":   true,
					"client_id": "github_client_id",
				},
			},
			{
				Provider: "google",
				Settings: map[string]any{
					"enabled":   true,
					"client_id": "google_client_id",
				},
			},
			{
				Provider: "azuread",
				Settings: map[string]any{
					"enabled":   true,
					"client_id": "azuread_client_id",
				},
			},
		}
		env.store.ExpectedSSOSettings = settingsList

		reloadable := ssosettingstests.NewMockReloadable(t)

		for _, settings := range settingsList {
			reloadable.On("Reload", mock.Anything, *settings).Return(nil).Once()
			env.reloadables[settings.Provider] = reloadable
		}

		env.service.doReload(context.Background())
	})

	t.Run("failed fetching the SSO settings", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := "github"

		env.store.ExpectedError = errors.New("failed fetching the settings")

		reloadable := ssosettingstests.NewMockReloadable(t)
		env.reloadables[provider] = reloadable

		env.service.doReload(context.Background())
	})
}

func setupTestEnv(t *testing.T) testEnv {
	store := ssosettingstests.NewFakeStore()
	fallbackStrategy := ssosettingstests.NewFakeFallbackStrategy()
	secrets := secretsFakes.NewMockService(t)
	accessControl := acimpl.ProvideAccessControl(setting.NewCfg())
	reloadables := make(map[string]ssosettings.Reloadable)

	fallbackStrategy.ExpectedIsMatch = true

	svc := &SSOSettingsService{
		log:          log.NewNopLogger(),
		store:        store,
		ac:           accessControl,
		fbStrategies: []ssosettings.FallbackStrategy{fallbackStrategy},
		reloadables:  reloadables,
		secrets:      secrets,
	}

	return testEnv{
		service:          svc,
		store:            store,
		ac:               accessControl,
		fallbackStrategy: fallbackStrategy,
		secrets:          secrets,
		reloadables:      reloadables,
	}
}

type testEnv struct {
	service          *SSOSettingsService
	store            *ssosettingstests.FakeStore
	ac               accesscontrol.AccessControl
	fallbackStrategy *ssosettingstests.FakeFallbackStrategy
	secrets          *secretsFakes.MockService
	reloadables      map[string]ssosettings.Reloadable
}
