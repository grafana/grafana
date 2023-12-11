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
					Provider:      "github",
					OAuthSettings: &social.OAuthInfo{Enabled: true},
					Source:        models.DB,
				}
			},
			want: &models.SSOSettings{
				Provider:      "github",
				OAuthSettings: &social.OAuthInfo{Enabled: true},
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
				env.fallbackStrategy.ExpectedConfig = &social.OAuthInfo{Enabled: true}
			},
			want: &models.SSOSettings{
				Provider:      "github",
				OAuthSettings: &social.OAuthInfo{Enabled: true},
				Source:        models.System,
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
						Provider:      "github",
						OAuthSettings: &social.OAuthInfo{Enabled: true},
						Source:        models.DB,
					},
					{
						Provider:      "okta",
						OAuthSettings: &social.OAuthInfo{Enabled: false},
						Source:        models.DB,
					},
				}
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfig = &social.OAuthInfo{Enabled: false}
			},
			want: []*models.SSOSettings{
				{
					Provider:      "github",
					OAuthSettings: &social.OAuthInfo{Enabled: true},
					Source:        models.DB,
				},
				{
					Provider:      "okta",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.DB,
				},
				{
					Provider:      "gitlab",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "generic_oauth",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "google",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "azuread",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "grafana_com",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
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
				env.fallbackStrategy.ExpectedConfig = &social.OAuthInfo{Enabled: false}
			},
			want: []*models.SSOSettings{
				{
					Provider:      "github",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "okta",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "gitlab",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "generic_oauth",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "google",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "azuread",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "grafana_com",
					OAuthSettings: &social.OAuthInfo{Enabled: false},
					Source:        models.System,
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

		settings := models.SSOSettings{
			Provider: "azuread",
			OAuthSettings: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
				Enabled:      true,
			},
			IsDeleted: false,
		}

		env.secrets.On("Encrypt", mock.Anything, []byte(settings.OAuthSettings.ClientSecret), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()

		err := env.service.Upsert(context.Background(), settings)
		require.NoError(t, err)
	})

	t.Run("returns error if secrets encryption failed", func(t *testing.T) {
		env := setupTestEnv(t)

		settings := models.SSOSettings{
			Provider: "azuread",
			OAuthSettings: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
				Enabled:      true,
			},
			IsDeleted: false,
		}

		env.secrets.On("Encrypt", mock.Anything, []byte(settings.OAuthSettings.ClientSecret), mock.Anything).Return(nil, errors.New("encryption failed")).Once()

		err := env.service.Upsert(context.Background(), settings)
		require.Error(t, err)
	})

	t.Run("returns error if store failed to upsert settings", func(t *testing.T) {
		env := setupTestEnv(t)

		settings := models.SSOSettings{
			Provider: "azuread",
			OAuthSettings: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
				Enabled:      true,
			},
			IsDeleted: false,
		}

		env.secrets.On("Encrypt", mock.Anything, []byte(settings.OAuthSettings.ClientSecret), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()
		env.store.ExpectedError = errors.New("upsert failed")

		err := env.service.Upsert(context.Background(), settings)
		require.Error(t, err)
	})
}

func TestSSOSettingsService_Delete(t *testing.T) {
	t.Run("successfully delete SSO settings", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := "azuread"
		env.store.ExpectedError = nil

		err := env.service.Delete(context.Background(), provider)
		require.NoError(t, err)
	})

	t.Run("SSO settings not found for the specified provider", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := "azuread"
		env.store.ExpectedError = ssosettings.ErrNotFound

		err := env.service.Delete(context.Background(), provider)
		require.Error(t, err)
		require.ErrorIs(t, err, ssosettings.ErrNotFound)
	})

	t.Run("store fails to delete the SSO settings for the specified provider", func(t *testing.T) {
		env := setupTestEnv(t)

		provider := "azuread"
		env.store.ExpectedError = errors.New("delete sso settings failed")

		err := env.service.Delete(context.Background(), provider)
		require.Error(t, err)
		require.NotErrorIs(t, err, ssosettings.ErrNotFound)
	})
}

func setupTestEnv(t *testing.T) testEnv {
	store := ssosettingstests.NewFakeStore()
	fallbackStrategy := ssosettingstests.NewFakeFallbackStrategy()
	secrets := secretsFakes.NewMockService(t)
	accessControl := acimpl.ProvideAccessControl(setting.NewCfg())

	svc := &SSOSettingsService{
		log:          log.NewNopLogger(),
		store:        store,
		ac:           accessControl,
		fbStrategies: []ssosettings.FallbackStrategy{fallbackStrategy},
		reloadables:  make(map[string]ssosettings.Reloadable),
		secrets:      secrets,
	}

	return testEnv{
		service:          svc,
		store:            store,
		ac:               accessControl,
		fallbackStrategy: fallbackStrategy,
		secrets:          secrets,
	}
}

type testEnv struct {
	service          *SSOSettingsService
	store            *ssosettingstests.FakeStore
	ac               accesscontrol.AccessControl
	fallbackStrategy *ssosettingstests.FakeFallbackStrategy
	secrets          *secretsFakes.MockService
}
