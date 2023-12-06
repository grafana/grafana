package ssosettingsimpl

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	sm "github.com/grafana/grafana/pkg/login/social/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
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
					OAuthSettings: &sm.OAuthInfo{Enabled: true},
					Source:        models.DB,
				}
			},
			want: &models.SSOSettings{
				Provider:      "github",
				OAuthSettings: &sm.OAuthInfo{Enabled: true},
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
				env.fallbackStrategy.ExpectedConfig = &sm.OAuthInfo{Enabled: true}
			},
			want: &models.SSOSettings{
				Provider:      "github",
				OAuthSettings: &sm.OAuthInfo{Enabled: true},
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
						OAuthSettings: &sm.OAuthInfo{Enabled: true},
						Source:        models.DB,
					},
					{
						Provider:      "okta",
						OAuthSettings: &sm.OAuthInfo{Enabled: false},
						Source:        models.DB,
					},
				}
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfig = &sm.OAuthInfo{Enabled: false}
			},
			want: []*models.SSOSettings{
				{
					Provider:      "github",
					OAuthSettings: &sm.OAuthInfo{Enabled: true},
					Source:        models.DB,
				},
				{
					Provider:      "okta",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.DB,
				},
				{
					Provider:      "gitlab",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "generic_oauth",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "google",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "azuread",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "grafana_com",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
			},
			wantErr: false,
		},
		// {
		// 	name: "should return the settings that the user has access to",
		// 	setup: func(env testEnv) {
		// 		env.store.ExpectedSSOSettings = []*models.SSOSettings{
		// 			{
		// 				Provider:      "github",
		// 				OAuthSettings: &sm.OAuthInfo{Enabled: true},
		// 				Source:        models.DB,
		// 			},
		// 			{
		// 				Provider:      "okta",
		// 				OAuthSettings: &sm.OAuthInfo{Enabled: true},
		// 				Source:        models.DB,
		// 			},
		// 		}
		// 		env.fallbackStrategy.ExpectedIsMatch = true
		// 		env.fallbackStrategy.ExpectedConfig = &sm.OAuthInfo{Enabled: false}
		// 	},
		// 	identity: scopedIdentity,
		// 	want: []*models.SSOSettings{
		// 		{
		// 			Provider:      "github",
		// 			OAuthSettings: &sm.OAuthInfo{Enabled: true},
		// 			Source:        models.DB,
		// 		},
		// 		{
		// 			Provider:      "azuread",
		// 			OAuthSettings: &sm.OAuthInfo{Enabled: false},
		// 			Source:        models.System,
		// 		},
		// 	},
		// 	wantErr: false,
		// },
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
				env.fallbackStrategy.ExpectedConfig = &sm.OAuthInfo{Enabled: false}
			},
			want: []*models.SSOSettings{
				{
					Provider:      "github",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "okta",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "gitlab",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "generic_oauth",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "google",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "azuread",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
					Source:        models.System,
				},
				{
					Provider:      "grafana_com",
					OAuthSettings: &sm.OAuthInfo{Enabled: false},
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

	accessControl := acimpl.ProvideAccessControl(setting.NewCfg())
	svc := &SSOSettingsService{
		log:          log.NewNopLogger(),
		store:        store,
		ac:           accessControl,
		fbStrategies: []ssosettings.FallbackStrategy{fallbackStrategy},
	}
	return testEnv{
		service:          svc,
		store:            store,
		ac:               accessControl,
		fallbackStrategy: fallbackStrategy,
	}
}

type testEnv struct {
	service          *SSOSettingsService
	store            *ssosettingstests.FakeStore
	ac               accesscontrol.AccessControl
	fallbackStrategy *ssosettingstests.FakeFallbackStrategy
}
