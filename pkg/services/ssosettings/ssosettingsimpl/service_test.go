package ssosettingsimpl

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"maps"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	secretsFakes "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/setting/settingtest"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestService_GetForProvider(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		provider string
		setup    func(env testEnv)
		want     *models.SSOSettings
		wantErr  bool
	}{
		{
			name:     "should return successfully",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSetting = &models.SSOSettings{
					Provider: "github",
					Settings: map[string]any{"enabled": true},
					Source:   models.DB,
				}
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"github": {
						"client_id":     "client_id",
						"client_secret": "secret",
					},
				}
			},
			want: &models.SSOSettings{
				Provider: "github",
				Settings: map[string]any{
					"enabled":       true,
					"client_id":     "client_id",
					"client_secret": "secret",
				},
			},
			wantErr: false,
		},
		{
			name:     "should return error if store returns an error different than not found",
			provider: "github",
			setup:    func(env testEnv) { env.store.ExpectedError = fmt.Errorf("error") },
			want:     nil,
			wantErr:  true,
		},
		{
			name:     "should fallback to the system settings if store returns not found",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"github": {
						"enabled":   true,
						"client_id": "client_id",
					},
				}
			},
			want: &models.SSOSettings{
				Provider: "github",
				Settings: map[string]any{
					"enabled":   true,
					"client_id": "client_id"},
				Source: models.System,
			},
			wantErr: false,
		},
		{
			name:     "should return error if the fallback strategy was not found",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = false
			},
			want:    nil,
			wantErr: true,
		},
		{
			name:     "should return error if fallback strategy returns error",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedError = fmt.Errorf("error")
			},
			want:    nil,
			wantErr: true,
		},
		{
			name:     "should decrypt secrets if data is coming from store",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSetting = &models.SSOSettings{
					Provider: "github",
					Settings: map[string]any{
						"enabled":       true,
						"client_secret": base64.RawStdEncoding.EncodeToString([]byte("client_secret")),
						"other_secret":  base64.RawStdEncoding.EncodeToString([]byte("other_secret")),
					},
					Source: models.DB,
				}
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"github": {
						"client_id": "client_id",
					},
				}

				env.secrets.On("Decrypt", mock.Anything, []byte("client_secret"), mock.Anything).Return([]byte("decrypted-client-secret"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("other_secret"), mock.Anything).Return([]byte("decrypted-other-secret"), nil).Once()
			},
			want: &models.SSOSettings{
				Provider: "github",
				Settings: map[string]any{
					"enabled":       true,
					"client_id":     "client_id",
					"client_secret": "decrypted-client-secret",
					"other_secret":  "decrypted-other-secret",
				},
				Source: models.DB,
			},
			wantErr: false,
		},
		{
			name:     "should decrypt secrets for LDAP if data is coming from store",
			provider: "ldap",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSetting = &models.SSOSettings{
					Provider: "ldap",
					Settings: map[string]any{
						"enabled": true,
						"config": map[string]any{
							"servers": []any{
								map[string]any{
									"host":          "192.168.0.1",
									"bind_password": base64.RawStdEncoding.EncodeToString([]byte("bind_password_1")),
									"client_key":    base64.RawStdEncoding.EncodeToString([]byte("client_key_1")),
								},
								map[string]any{
									"host":          "192.168.0.2",
									"bind_password": base64.RawStdEncoding.EncodeToString([]byte("bind_password_2")),
									"client_key":    base64.RawStdEncoding.EncodeToString([]byte("client_key_2")),
								},
							},
						},
					},
					Source: models.DB,
				}
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{}

				env.secrets.On("Decrypt", mock.Anything, []byte("bind_password_1"), mock.Anything).Return([]byte("decrypted-bind-password-1"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("client_key_1"), mock.Anything).Return([]byte("decrypted-client-key-1"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("bind_password_2"), mock.Anything).Return([]byte("decrypted-bind-password-2"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("client_key_2"), mock.Anything).Return([]byte("decrypted-client-key-2"), nil).Once()
			},
			want: &models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host":          "192.168.0.1",
								"bind_password": "decrypted-bind-password-1",
								"client_key":    "decrypted-client-key-1",
							},
							map[string]any{
								"host":          "192.168.0.2",
								"bind_password": "decrypted-bind-password-2",
								"client_key":    "decrypted-client-key-2",
							},
						},
					},
				},
				Source: models.DB,
			},
			wantErr: false,
		},
		{
			name:     "should not decrypt secrets if data is coming from the fallback strategy",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"github": {
						"enabled":       true,
						"client_id":     "client_id",
						"client_secret": "client_secret",
					},
				}
			},
			want: &models.SSOSettings{
				Provider: "github",
				Settings: map[string]any{
					"enabled":       true,
					"client_id":     "client_id",
					"client_secret": "client_secret",
				},
				Source: models.System,
			},
			wantErr: false,
		},
		{
			name:     "should return an error if the data in the store is invalid",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSetting = &models.SSOSettings{
					Provider: "github",
					Settings: map[string]any{
						"enabled":       true,
						"client_secret": "not a valid base64 string",
					},
					Source: models.DB,
				}
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"github": {
						"client_id": "client_id",
					},
				}
			},
			wantErr: true,
		},
		{
			name:     "correctly merge URLs from the DB and system settings",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSetting = &models.SSOSettings{
					Provider: "github",
					Settings: map[string]any{
						"enabled":  true,
						"auth_url": "",
						"api_url":  "https://overwritten-api.com/user",
						"team_ids": "",
					},
					Source: models.DB,
				}
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"github": {
						"auth_url":  "https://github.com/login/oauth/authorize",
						"token_url": "https://github.com/login/oauth/access_token",
						"api_url":   "https://api.github.com/user",
						"team_ids":  "10,11,12",
					},
				}
			},
			want: &models.SSOSettings{
				Provider: "github",
				Settings: map[string]any{
					"enabled":   true,
					"auth_url":  "https://github.com/login/oauth/authorize",
					"token_url": "https://github.com/login/oauth/access_token",
					"api_url":   "https://overwritten-api.com/user",
					"team_ids":  "",
				},
				Source: models.DB,
			},
			wantErr: false,
		},
		{
			name:     "correctly merge group of settings for SAML",
			provider: "saml",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSetting = &models.SSOSettings{
					Provider: "saml",
					Settings: map[string]any{
						"certificate":      base64.RawStdEncoding.EncodeToString([]byte("valid-certificate")),
						"private_key_path": base64.RawStdEncoding.EncodeToString([]byte("path/to/private/key")),
						"idp_metadata_url": "https://idp-metadata.com",
					},
					Source: models.DB,
				}
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"saml": {
						"name":              "test-settings",
						"certificate_path":  "path/to/certificate",
						"private_key":       "this-is-a-valid-private-key",
						"idp_metadata_path": "path/to/metadata",
						"max_issue_delay":   "1h",
					},
				}
				env.secrets.On("Decrypt", mock.Anything, []byte("valid-certificate"), mock.Anything).Return([]byte("decrypted-valid-certificate"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("path/to/private/key"), mock.Anything).Return([]byte("decrypted/path/to/private/key"), nil).Once()
			},
			want: &models.SSOSettings{
				Provider: "saml",
				Settings: map[string]any{
					"name":             "test-settings",
					"certificate":      "decrypted-valid-certificate",
					"private_key_path": "decrypted/path/to/private/key",
					"idp_metadata_url": "https://idp-metadata.com",
					"max_issue_delay":  "1h",
				},
				Source: models.DB,
			},
			wantErr: false,
		},
	}

	for _, tc := range testCases {
		// create a local copy of "tc" to allow concurrent access within tests to the different items of testCases,
		// otherwise it would be like a moving pointer while tests run in parallel
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			env := setupTestEnv(t, true, false, true)
			if tc.setup != nil {
				tc.setup(env)
			}

			actual, err := env.service.GetForProvider(context.Background(), tc.provider)

			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.want, actual)

			env.secrets.AssertExpectations(t)
		})
	}
}

func TestService_GetForProviderWithRedactedSecrets(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		provider string
		setup    func(env testEnv)
		want     *models.SSOSettings
		wantErr  bool
	}{
		{
			name:     "should return successfully and redact secrets",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSetting = &models.SSOSettings{
					Provider: "github",
					Settings: map[string]any{
						"enabled":       true,
						"secret":        base64.RawStdEncoding.EncodeToString([]byte("secret")),
						"client_secret": base64.RawStdEncoding.EncodeToString([]byte("client_secret")),
						"client_id":     "client_id",
					},
					Source: models.DB,
				}
				env.secrets.On("Decrypt", mock.Anything, []byte("client_secret"), mock.Anything).Return([]byte("decrypted-client-secret"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("secret"), mock.Anything).Return([]byte("decrypted-secret"), nil).Once()
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
			name:     "should return successfully and redact secrets for LDAP",
			provider: "ldap",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSetting = &models.SSOSettings{
					Provider: "ldap",
					Settings: map[string]any{
						"enabled": true,
						"config": map[string]any{
							"servers": []any{
								map[string]any{
									"host":          "192.168.0.1",
									"bind_password": base64.RawStdEncoding.EncodeToString([]byte("bind_password_1")),
									"client_key":    base64.RawStdEncoding.EncodeToString([]byte("client_key_1")),
								},
								map[string]any{
									"host":          "192.168.0.2",
									"bind_password": base64.RawStdEncoding.EncodeToString([]byte("bind_password_2")),
									"client_key":    base64.RawStdEncoding.EncodeToString([]byte("client_key_2")),
								},
							},
						},
					},
					Source: models.DB,
				}
				env.secrets.On("Decrypt", mock.Anything, []byte("bind_password_1"), mock.Anything).Return([]byte("decrypted-bind-password-1"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("client_key_1"), mock.Anything).Return([]byte("decrypted-client-key-1"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("bind_password_2"), mock.Anything).Return([]byte("decrypted-bind-password-2"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("client_key_2"), mock.Anything).Return([]byte("decrypted-client-key-2"), nil).Once()
			},
			want: &models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host":          "192.168.0.1",
								"bind_password": "*********",
								"client_key":    "*********",
							},
							map[string]any{
								"host":          "192.168.0.2",
								"bind_password": "*********",
								"client_key":    "*********",
							},
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name:     "should return error if store returns an error different than not found",
			provider: "github",
			setup:    func(env testEnv) { env.store.ExpectedError = fmt.Errorf("error") },
			want:     nil,
			wantErr:  true,
		},
		{
			name:     "should fallback to strategy if store returns not found",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"github": {
						"enabled": true,
					},
				}
			},
			want: &models.SSOSettings{
				Provider: "github",
				Settings: map[string]any{"enabled": true},
				Source:   models.System,
			},
			wantErr: false,
		},
		{
			name:     "should return error if the fallback strategy was not found",
			provider: "github",
			setup: func(env testEnv) {
				env.store.ExpectedError = ssosettings.ErrNotFound
				env.fallbackStrategy.ExpectedIsMatch = false
			},
			want:    nil,
			wantErr: true,
		},
		{
			name:     "should return error if fallback strategy returns error",
			provider: "github",
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
		// create a local copy of "tc" to allow concurrent access within tests to the different items of testCases,
		// otherwise it would be like a moving pointer while tests run in parallel
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			env := setupTestEnv(t, false, false, true)
			if tc.setup != nil {
				tc.setup(env)
			}

			actual, err := env.service.GetForProviderWithRedactedSecrets(context.Background(), tc.provider)

			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.want, actual)
		})
	}
}

func TestService_List(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name    string
		setup   func(env testEnv)
		want    []*models.SSOSettings
		wantErr bool
	}{
		{
			name: "should return all oauth providers successfully without saml",
			setup: func(env testEnv) {
				env.store.ExpectedSSOSettings = []*models.SSOSettings{
					{
						Provider: "github",
						Settings: map[string]any{
							"enabled":       true,
							"client_secret": base64.RawStdEncoding.EncodeToString([]byte("client_secret")),
						},
						Source: models.DB,
					},
					{
						Provider: "okta",
						Settings: map[string]any{
							"enabled":      false,
							"other_secret": base64.RawStdEncoding.EncodeToString([]byte("other_secret")),
						},
						Source: models.DB,
					},
				}
				env.secrets.On("Decrypt", mock.Anything, []byte("client_secret"), mock.Anything).Return([]byte("decrypted-client-secret"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("other_secret"), mock.Anything).Return([]byte("decrypted-other-secret"), nil).Once()

				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"github": {
						"enabled":       false,
						"client_id":     "client_id",
						"client_secret": "secret1",
						"token_url":     "token_url",
					},
					"okta": {
						"enabled":       false,
						"client_id":     "client_id",
						"client_secret": "coming-from-system",
						"other_secret":  "secret2",
						"token_url":     "token_url",
					},
					"gitlab": {
						"enabled": false,
					},
					"generic_oauth": {
						"enabled": false,
					},
					"google": {
						"enabled": false,
					},
					"azuread": {
						"enabled": false,
					},
					"grafana_com": {
						"enabled": false,
					},
				}
			},
			want: []*models.SSOSettings{
				{
					Provider: "github",
					Settings: map[string]any{
						"enabled":       true,
						"client_id":     "client_id",
						"client_secret": "decrypted-client-secret", // client_secret is coming from the database, must be decrypted first
						"token_url":     "token_url",
					},
					Source: models.DB,
				},
				{
					Provider: "okta",
					Settings: map[string]any{
						"enabled":       false,
						"client_id":     "client_id",
						"client_secret": "coming-from-system", // client_secret is coming from the system, must not be decrypted
						"other_secret":  "decrypted-other-secret",
						"token_url":     "token_url",
					},
					Source: models.DB,
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
		// create a local copy of "tc" to allow concurrent access within tests to the different items of testCases,
		// otherwise it would be like a moving pointer while tests run in parallel
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			env := setupTestEnv(t, false, false, false)
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

func TestService_ListWithRedactedSecrets(t *testing.T) {
	t.Parallel()

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
						Settings: map[string]any{
							"enabled":       true,
							"client_secret": base64.RawStdEncoding.EncodeToString([]byte("client_secret")),
							"client_id":     "client_id",
						},
						Source: models.DB,
					},
					{
						Provider: "okta",
						Settings: map[string]any{
							"enabled":      false,
							"other_secret": base64.RawStdEncoding.EncodeToString([]byte("other_secret")),
							"client_id":    "client_id",
						},
						Source: models.DB,
					},
				}
				env.secrets.On("Decrypt", mock.Anything, []byte("client_secret"), mock.Anything).Return([]byte("decrypted-client-secret"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("other_secret"), mock.Anything).Return([]byte("decrypted-other-secret"), nil).Once()

				env.fallbackStrategy.ExpectedIsMatch = true
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"github": {
						"enabled":       true,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"okta": {
						"enabled":       true,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"gitlab": {
						"enabled":       true,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"generic_oauth": {
						"enabled":       true,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"google": {
						"enabled":       true,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"azuread": {
						"enabled":       true,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"grafana_com": {
						"enabled":       true,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
				}
			},
			want: []*models.SSOSettings{
				{
					Provider: "github",
					Settings: map[string]any{
						"enabled":       true,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.DB,
				},
				{
					Provider: "okta",
					Settings: map[string]any{
						"enabled":       false,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
						"other_secret":  "*********",
					},
					Source: models.DB,
				},
				{
					Provider: "gitlab",
					Settings: map[string]any{
						"enabled":       true,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.System,
				},
				{
					Provider: "generic_oauth",
					Settings: map[string]any{
						"enabled":       true,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.System,
				},
				{
					Provider: "google",
					Settings: map[string]any{
						"enabled":       true,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.System,
				},
				{
					Provider: "azuread",
					Settings: map[string]any{
						"enabled":       true,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.System,
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
				env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
					"github": {
						"enabled":       false,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"okta": {
						"enabled":       false,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"gitlab": {
						"enabled":       false,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"generic_oauth": {
						"enabled":       false,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"google": {
						"enabled":       false,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"azuread": {
						"enabled":       false,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
					"grafana_com": {
						"enabled":       false,
						"secret":        "secret",
						"client_secret": "client_secret",
						"client_id":     "client_id",
					},
				}
			},
			want: []*models.SSOSettings{
				{
					Provider: "github",
					Settings: map[string]any{
						"enabled":       false,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.System,
				},
				{
					Provider: "okta",
					Settings: map[string]any{
						"enabled":       false,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.System,
				},
				{
					Provider: "gitlab",
					Settings: map[string]any{
						"enabled":       false,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.System,
				},
				{
					Provider: "generic_oauth",
					Settings: map[string]any{
						"enabled":       false,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.System,
				},
				{
					Provider: "google",
					Settings: map[string]any{
						"enabled":       false,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.System,
				},
				{
					Provider: "azuread",
					Settings: map[string]any{
						"enabled":       false,
						"secret":        "*********",
						"client_secret": "*********",
						"client_id":     "client_id",
					},
					Source: models.System,
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
		// create a local copy of "tc" to allow concurrent access within tests to the different items of testCases,
		// otherwise it would be like a moving pointer while tests run in parallel
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			env := setupTestEnv(t, false, false, false)
			if tc.setup != nil {
				tc.setup(env)
			}

			actual, err := env.service.ListWithRedactedSecrets(context.Background())

			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.ElementsMatch(t, tc.want, actual)
		})
	}
}

func TestService_Upsert(t *testing.T) {
	t.Parallel()

	t.Run("successfully upsert SSO settings", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

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
		var wg sync.WaitGroup
		wg.Add(1)

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, settings, mock.Anything, mock.Anything).Return(nil)
		reloadable.On("Reload", mock.Anything, mock.MatchedBy(func(settings models.SSOSettings) bool {
			defer wg.Done()
			return settings.Provider == provider &&
				settings.ID == "someid" &&
				maps.Equal(settings.Settings, map[string]any{
					"client_id":     "client-id",
					"client_secret": "client-secret",
					"enabled":       true,
				})
		})).Return(nil).Once()
		env.reloadables[provider] = reloadable
		env.secrets.On("Encrypt", mock.Anything, []byte(settings.Settings["client_secret"].(string)), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()
		env.secrets.On("Decrypt", mock.Anything, []byte("encrypted-current-client-secret"), mock.Anything).Return([]byte("current-client-secret"), nil).Once()

		env.store.UpsertFn = func(ctx context.Context, settings *models.SSOSettings) error {
			currentTime := time.Now()
			settings.ID = "someid"
			settings.Created = currentTime
			settings.Updated = currentTime

			env.store.ActualSSOSettings = *settings
			return nil
		}

		env.store.GetFn = func(ctx context.Context, provider string) (*models.SSOSettings, error) {
			return &models.SSOSettings{
				ID:       "someid",
				Provider: provider,
				Settings: map[string]any{
					"client_secret": base64.RawStdEncoding.EncodeToString([]byte("encrypted-current-client-secret")),
				},
			}, nil
		}
		err := env.service.Upsert(context.Background(), &settings, &user.SignedInUser{})
		require.NoError(t, err)

		// Wait for the goroutine first to assert the Reload call
		wg.Wait()

		settings.Settings["client_secret"] = base64.RawStdEncoding.EncodeToString([]byte("encrypted-client-secret"))
		require.EqualValues(t, settings, env.store.ActualSSOSettings)
	})

	t.Run("successfully upsert SSO settings for LDAP", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, true)

		provider := social.LDAPProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"enabled": true,
				"config": map[string]any{
					"servers": []any{
						map[string]any{
							"host":          "192.168.0.1",
							"bind_password": "bind_password_1",
							"client_key":    "client_key_1",
						},
						map[string]any{
							"host":          "192.168.0.2",
							"bind_password": "bind_password_2",
							"client_key":    "client_key_2",
						},
					},
				},
			},
		}
		var wg sync.WaitGroup
		wg.Add(1)

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, settings, mock.Anything, mock.Anything).Return(nil)
		reloadable.On("Reload", mock.Anything, mock.MatchedBy(func(settings models.SSOSettings) bool {
			defer wg.Done()
			return settings.Provider == provider &&
				settings.ID == "someid" &&
				maps.Equal(settings.Settings["config"].(map[string]any)["servers"].([]any)[0].(map[string]any), map[string]any{
					"host":          "192.168.0.1",
					"bind_password": "bind_password_1",
					"client_key":    "client_key_1",
				}) && maps.Equal(settings.Settings["config"].(map[string]any)["servers"].([]any)[1].(map[string]any), map[string]any{
				"host":          "192.168.0.2",
				"bind_password": "bind_password_2",
				"client_key":    "client_key_2",
			})
		})).Return(nil).Once()
		env.reloadables[provider] = reloadable
		env.secrets.On("Encrypt", mock.Anything, []byte("bind_password_1"), mock.Anything).Return([]byte("encrypted-bind-password-1"), nil).Once()
		env.secrets.On("Encrypt", mock.Anything, []byte("bind_password_2"), mock.Anything).Return([]byte("encrypted-bind-password-2"), nil).Once()
		env.secrets.On("Encrypt", mock.Anything, []byte("client_key_1"), mock.Anything).Return([]byte("encrypted-client-key-1"), nil).Once()
		env.secrets.On("Encrypt", mock.Anything, []byte("client_key_2"), mock.Anything).Return([]byte("encrypted-client-key-2"), nil).Once()

		env.store.UpsertFn = func(ctx context.Context, settings *models.SSOSettings) error {
			currentTime := time.Now()
			settings.ID = "someid"
			settings.Created = currentTime
			settings.Updated = currentTime

			env.store.ActualSSOSettings = *settings
			return nil
		}

		err := env.service.Upsert(context.Background(), &settings, &user.SignedInUser{})
		require.NoError(t, err)

		// Wait for the goroutine first to assert the Reload call
		wg.Wait()

		require.EqualValues(t, settings, env.store.ActualSSOSettings)
	})

	t.Run("returns error if provider is not configurable", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		provider := social.GrafanaComProviderName
		settings := &models.SSOSettings{
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

		err := env.service.Upsert(context.Background(), settings, &user.SignedInUser{})
		require.Error(t, err)
	})

	t.Run("returns error if provider was not found in reloadables", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		provider := social.AzureADProviderName
		settings := &models.SSOSettings{
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

		err := env.service.Upsert(context.Background(), settings, &user.SignedInUser{})
		require.Error(t, err)
	})

	t.Run("returns error if validation fails", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

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
		reloadable.On("Validate", mock.Anything, settings, mock.Anything, mock.Anything).Return(errors.New("validation failed"))
		env.reloadables[provider] = reloadable

		err := env.service.Upsert(context.Background(), &settings, &user.SignedInUser{})
		require.Error(t, err)
	})

	t.Run("returns error if a fallback strategy is not available for the provider", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		settings := &models.SSOSettings{
			Provider: social.AzureADProviderName,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
			IsDeleted: false,
		}

		env.fallbackStrategy.ExpectedIsMatch = false

		err := env.service.Upsert(context.Background(), settings, &user.SignedInUser{})
		require.Error(t, err)
	})

	t.Run("returns error if a secret does not have the type string", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		provider := social.OktaProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": 123,
				"enabled":       true,
			},
			IsDeleted: false,
		}

		reloadable := ssosettingstests.NewMockReloadable(t)
		env.reloadables[provider] = reloadable

		err := env.service.Upsert(context.Background(), &settings, &user.SignedInUser{})
		require.Error(t, err)
	})

	t.Run("returns error if secrets encryption failed", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

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
		reloadable.On("Validate", mock.Anything, settings, mock.Anything, mock.Anything).Return(nil)
		env.reloadables[provider] = reloadable
		env.secrets.On("Encrypt", mock.Anything, []byte(settings.Settings["client_secret"].(string)), mock.Anything).Return(nil, errors.New("encryption failed")).Once()

		err := env.service.Upsert(context.Background(), &settings, &user.SignedInUser{})
		require.Error(t, err)
	})

	t.Run("should not update the current secret if the secret has not been updated", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		provider := social.AzureADProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_id":     "client-id",
				"client_secret": setting.RedactedPassword,
				"enabled":       true,
			},
			IsDeleted: false,
		}

		env.store.ExpectedSSOSetting = &models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_secret": base64.RawStdEncoding.EncodeToString([]byte("current-client-secret")),
			},
		}

		expected := settings
		expected.Settings = make(map[string]any)
		for key, value := range settings.Settings {
			expected.Settings[key] = value
		}
		expected.Settings["client_secret"] = "encrypted-client-secret"

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, expected, mock.Anything, mock.Anything).Return(nil)
		reloadable.On("Reload", mock.Anything, mock.Anything).Return(nil).Maybe()
		env.reloadables[provider] = reloadable
		env.secrets.On("Decrypt", mock.Anything, []byte("current-client-secret"), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()
		env.secrets.On("Encrypt", mock.Anything, []byte("encrypted-client-secret"), mock.Anything).Return([]byte("current-client-secret"), nil).Once()

		err := env.service.Upsert(context.Background(), &settings, &user.SignedInUser{})
		require.NoError(t, err)

		expected.Settings["client_secret"] = base64.RawStdEncoding.EncodeToString([]byte("current-client-secret"))
		require.EqualValues(t, expected, env.store.ActualSSOSettings)
	})

	t.Run("run validation with all new and current secrets available in settings", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		provider := social.AzureADProviderName
		settings := models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_secret": setting.RedactedPassword,
				"private_key":   setting.RedactedPassword,
				"certificate":   "new-certificate",
			},
			IsDeleted: false,
		}

		env.store.ExpectedSSOSetting = &models.SSOSettings{
			Provider: provider,
			Settings: map[string]any{
				"client_secret": base64.RawStdEncoding.EncodeToString([]byte("encrypted-current-client-secret")),
				"private_key":   base64.RawStdEncoding.EncodeToString([]byte("encrypted-current-private-key")),
				"certificate":   base64.RawStdEncoding.EncodeToString([]byte("encrypted-current-certificate")),
			},
		}

		expected := settings
		expected.Settings = make(map[string]any)
		for key, value := range settings.Settings {
			expected.Settings[key] = value
		}
		expected.Settings["client_secret"] = "current-client-secret"
		expected.Settings["private_key"] = "current-private-key"

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Validate", mock.Anything, expected, mock.Anything, mock.Anything).Return(nil)
		reloadable.On("Reload", mock.Anything, mock.Anything).Return(nil).Maybe()
		env.reloadables[provider] = reloadable
		env.secrets.On("Decrypt", mock.Anything, []byte("encrypted-current-client-secret"), mock.Anything).Return([]byte("current-client-secret"), nil).Once()
		env.secrets.On("Decrypt", mock.Anything, []byte("encrypted-current-private-key"), mock.Anything).Return([]byte("current-private-key"), nil).Once()
		env.secrets.On("Decrypt", mock.Anything, []byte("encrypted-current-certificate"), mock.Anything).Return([]byte("current-certificate"), nil).Once()
		env.secrets.On("Encrypt", mock.Anything, []byte("current-client-secret"), mock.Anything).Return([]byte("encrypted-current-client-secret"), nil).Once()
		env.secrets.On("Encrypt", mock.Anything, []byte("current-private-key"), mock.Anything).Return([]byte("encrypted-current-private-key"), nil).Once()
		env.secrets.On("Encrypt", mock.Anything, []byte("new-certificate"), mock.Anything).Return([]byte("encrypted-new-certificate"), nil).Once()

		err := env.service.Upsert(context.Background(), &settings, &user.SignedInUser{})
		require.NoError(t, err)

		expected.Settings["client_secret"] = base64.RawStdEncoding.EncodeToString([]byte("encrypted-current-client-secret"))
		expected.Settings["private_key"] = base64.RawStdEncoding.EncodeToString([]byte("encrypted-current-private-key"))
		expected.Settings["certificate"] = base64.RawStdEncoding.EncodeToString([]byte("encrypted-new-certificate"))
		require.EqualValues(t, expected, env.store.ActualSSOSettings)
	})

	t.Run("returns error if store failed to upsert settings", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

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
		reloadable.On("Validate", mock.Anything, settings, mock.Anything, mock.Anything).Return(nil)
		env.reloadables[provider] = reloadable
		env.secrets.On("Encrypt", mock.Anything, []byte(settings.Settings["client_secret"].(string)), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()
		env.store.GetFn = func(ctx context.Context, provider string) (*models.SSOSettings, error) {
			return &models.SSOSettings{}, nil
		}

		env.store.UpsertFn = func(ctx context.Context, settings *models.SSOSettings) error {
			return errors.New("failed to upsert settings")
		}

		err := env.service.Upsert(context.Background(), &settings, &user.SignedInUser{})
		require.Error(t, err)
	})

	t.Run("successfully upsert SSO settings if reload fails", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

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
		reloadable.On("Validate", mock.Anything, settings, mock.Anything, mock.Anything).Return(nil)
		reloadable.On("Reload", mock.Anything, mock.Anything).Return(errors.New("failed reloading new settings")).Maybe()
		env.reloadables[provider] = reloadable
		env.secrets.On("Encrypt", mock.Anything, []byte(settings.Settings["client_secret"].(string)), mock.Anything).Return([]byte("encrypted-client-secret"), nil).Once()

		err := env.service.Upsert(context.Background(), &settings, &user.SignedInUser{})
		require.NoError(t, err)

		settings.Settings["client_secret"] = base64.RawStdEncoding.EncodeToString([]byte("encrypted-client-secret"))
		require.EqualValues(t, settings, env.store.ActualSSOSettings)
	})
}

func TestService_Delete(t *testing.T) {
	t.Parallel()

	t.Run("successfully delete SSO settings", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		var wg sync.WaitGroup
		wg.Add(1)

		provider := social.AzureADProviderName
		reloadable := ssosettingstests.NewMockReloadable(t)
		env.reloadables[provider] = reloadable

		env.fallbackStrategy.ExpectedConfigs = map[string]map[string]any{
			provider: {
				"client_id":     "client-id",
				"client_secret": "client-secret",
				"enabled":       true,
			},
		}

		reloadable.On("Reload", mock.Anything, mock.MatchedBy(func(settings models.SSOSettings) bool {
			wg.Done()
			return settings.Provider == provider &&
				settings.ID == "" &&
				maps.Equal(settings.Settings, map[string]any{
					"client_id":     "client-id",
					"client_secret": "client-secret",
					"enabled":       true,
				})
		})).Return(nil).Once()

		err := env.service.Delete(context.Background(), provider)
		require.NoError(t, err)

		// wait for the goroutine first to assert the Reload call
		wg.Wait()
	})

	t.Run("return error if SSO setting was not found for the specified provider", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		provider := social.AzureADProviderName
		reloadable := ssosettingstests.NewMockReloadable(t)
		env.reloadables[provider] = reloadable
		env.store.ExpectedError = ssosettings.ErrNotFound

		err := env.service.Delete(context.Background(), provider)
		require.Error(t, err)

		require.ErrorIs(t, err, ssosettings.ErrNotFound)
	})

	t.Run("should not delete the SSO settings if the provider is not configurable", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)
		env.cfg.SSOSettingsConfigurableProviders = map[string]bool{social.AzureADProviderName: true}

		provider := social.GrafanaComProviderName
		env.store.ExpectedError = nil

		err := env.service.Delete(context.Background(), provider)
		require.ErrorIs(t, err, ssosettings.ErrNotConfigurable)
	})

	t.Run("return error when store fails to delete the SSO settings for the specified provider", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		provider := social.AzureADProviderName
		env.store.ExpectedError = errors.New("delete sso settings failed")

		err := env.service.Delete(context.Background(), provider)
		require.Error(t, err)
		require.NotErrorIs(t, err, ssosettings.ErrNotFound)
	})

	t.Run("return successfully when the deletion was successful but reloading the settings fail", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		provider := social.AzureADProviderName
		reloadable := ssosettingstests.NewMockReloadable(t)
		env.reloadables[provider] = reloadable

		env.store.GetFn = func(ctx context.Context, provider string) (*models.SSOSettings, error) {
			return nil, errors.New("failed to get sso settings")
		}

		err := env.service.Delete(context.Background(), provider)

		require.NoError(t, err)
	})

	t.Run("should delete SAML SettingsProvider while deleting SAML SSO Settings", func(t *testing.T) {
		t.Parallel()
		env := setupTestEnv(t, true, true, false)

		mockProvider := &settingtest.MockProvider{}
		mockProvider.On("Current", mock.Anything).Return(setting.SettingsBag{
			"auth.saml": map[string]string{
				"name": "mockedName",
			},
		}).Twice()
		mockProvider.On(
			"Update",
			setting.SettingsBag{},
			setting.SettingsRemovals{"auth.saml": []string{"name"}}).Return(nil).Once()
		env.service.settingsProvider = mockProvider

		provider := social.SAMLProviderName
		reloadable := ssosettingstests.NewMockReloadable(t)

		var wg sync.WaitGroup
		wg.Add(1)
		reloadable.On("Reload", mock.Anything, mock.MatchedBy(func(settings models.SSOSettings) bool {
			wg.Done()
			return settings.Provider == provider && settings.ID == ""
		})).Return(nil).Once()
		env.reloadables[provider] = reloadable

		err := env.service.Delete(context.Background(), provider)
		require.NoError(t, err)
		wg.Wait()
	})
}

// we might not need this test because it is not testing the public interface
// it was added for convenient testing of the internal deep copy and remove secrets
func TestRemoveSecrets(t *testing.T) {
	settings := map[string]any{
		"enabled":       true,
		"client_secret": "client_secret",
		"config": map[string]any{
			"servers": []any{
				map[string]any{
					"host":          "192.168.0.1",
					"bind_password": "bind_password_1",
					"client_key":    "client_key_1",
				},
				map[string]any{
					"host":          "192.168.0.2",
					"bind_password": "bind_password_2",
					"client_key":    "client_key_2",
				},
			},
		},
	}

	copiedSettings := deepCopyMap(settings)
	copiedSettings["client_secret"] = "client_secret_updated"
	copiedSettings["config"].(map[string]any)["servers"].([]any)[0].(map[string]any)["bind_password"] = "bind_password_1_updated"

	require.Equal(t, "client_secret", settings["client_secret"])
	require.Equal(t, "client_secret_updated", copiedSettings["client_secret"])
	require.Equal(t, "bind_password_1", settings["config"].(map[string]any)["servers"].([]any)[0].(map[string]any)["bind_password"])
	require.Equal(t, "bind_password_1_updated", copiedSettings["config"].(map[string]any)["servers"].([]any)[0].(map[string]any)["bind_password"])

	settingsWithRedactedSecrets := removeSecrets(settings)
	require.Equal(t, "client_secret", settings["client_secret"])
	require.Equal(t, "*********", settingsWithRedactedSecrets["client_secret"])
	require.Equal(t, "bind_password_1", settings["config"].(map[string]any)["servers"].([]any)[0].(map[string]any)["bind_password"])
	require.Equal(t, "*********", settingsWithRedactedSecrets["config"].(map[string]any)["servers"].([]any)[0].(map[string]any)["bind_password"])
}

func TestService_DoReload(t *testing.T) {
	t.Parallel()

	t.Run("successfully reload settings", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

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

	t.Run("successfully reload settings when some providers have empty settings", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		settingsList := []*models.SSOSettings{
			{
				Provider: "azuread",
				Settings: map[string]any{
					"enabled":   true,
					"client_id": "azuread_client_id",
				},
			},
			{
				Provider: "google",
				Settings: map[string]any{},
			},
		}
		env.store.ExpectedSSOSettings = settingsList

		reloadable := ssosettingstests.NewMockReloadable(t)
		reloadable.On("Reload", mock.Anything, *settingsList[0]).Return(nil).Once()
		env.reloadables["azuread"] = reloadable

		// registers a provider with empty settings
		env.reloadables["github"] = nil

		env.service.doReload(context.Background())
	})

	t.Run("failed fetching the SSO settings", func(t *testing.T) {
		t.Parallel()

		env := setupTestEnv(t, false, false, false)

		provider := "github"

		env.store.ExpectedError = errors.New("failed fetching the settings")

		reloadable := ssosettingstests.NewMockReloadable(t)
		env.reloadables[provider] = reloadable

		env.service.doReload(context.Background())
	})
}

func TestService_decryptSecrets(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		setup    func(env testEnv)
		settings map[string]any
		want     map[string]any
		wantErr  bool
	}{
		{
			name: "should decrypt secrets successfully",
			setup: func(env testEnv) {
				env.secrets.On("Decrypt", mock.Anything, []byte("client_secret"), mock.Anything).Return([]byte("decrypted-client-secret"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("other_secret"), mock.Anything).Return([]byte("decrypted-other-secret"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("private_key"), mock.Anything).Return([]byte("decrypted-private-key"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("certificate"), mock.Anything).Return([]byte("decrypted-certificate"), nil).Once()
			},
			settings: map[string]any{
				"enabled":       true,
				"client_secret": base64.RawStdEncoding.EncodeToString([]byte("client_secret")),
				"other_secret":  base64.RawStdEncoding.EncodeToString([]byte("other_secret")),
				"private_key":   base64.RawStdEncoding.EncodeToString([]byte("private_key")),
				"certificate":   base64.RawStdEncoding.EncodeToString([]byte("certificate")),
			},
			want: map[string]any{
				"enabled":       true,
				"client_secret": "decrypted-client-secret",
				"other_secret":  "decrypted-other-secret",
				"private_key":   "decrypted-private-key",
				"certificate":   "decrypted-certificate",
			},
		},
		{
			name: "should decrypt LDAP secrets successfully",
			setup: func(env testEnv) {
				env.secrets.On("Decrypt", mock.Anything, []byte("client_key"), mock.Anything).Return([]byte("decrypted-client-key"), nil).Once()
				env.secrets.On("Decrypt", mock.Anything, []byte("bind_password"), mock.Anything).Return([]byte("decrypted-bind-password"), nil).Once()
			},
			settings: map[string]any{
				"enabled": true,
				"config": map[string]any{
					"servers": []any{
						map[string]any{
							"client_key":    base64.RawStdEncoding.EncodeToString([]byte("client_key")),
							"bind_password": base64.RawStdEncoding.EncodeToString([]byte("bind_password")),
						},
					},
				},
			},
			want: map[string]any{
				"enabled": true,
				"config": map[string]any{
					"servers": []any{
						map[string]any{
							"client_key":    "decrypted-client-key",
							"bind_password": "decrypted-bind-password",
						},
					},
				},
			},
		},
		{
			name: "should not decrypt when a secret is empty",
			setup: func(env testEnv) {
				env.secrets.On("Decrypt", mock.Anything, []byte("other_secret"), mock.Anything).Return([]byte("decrypted-other-secret"), nil).Once()
			},
			settings: map[string]any{
				"enabled":       true,
				"client_secret": "",
				"other_secret":  base64.RawStdEncoding.EncodeToString([]byte("other_secret")),
			},
			want: map[string]any{
				"enabled":       true,
				"client_secret": "",
				"other_secret":  "decrypted-other-secret",
			},
		},
		{
			name: "should return an error if data is not a string",
			settings: map[string]any{
				"enabled":       true,
				"client_secret": 2,
				"other_secret":  2,
			},
			wantErr: true,
		},
		{
			name: "should return an error if data is not a valid base64 string",
			settings: map[string]any{
				"enabled":       true,
				"client_secret": "client_secret",
				"other_secret":  "other_secret",
			},
			wantErr: true,
		},
		{
			name: "should return an error if decryption fails",
			setup: func(env testEnv) {
				env.secrets.On("Decrypt", mock.Anything, []byte("client_secret"), mock.Anything).Return(nil, errors.New("decryption failed")).Once()
			},
			settings: map[string]any{
				"enabled":       true,
				"client_secret": base64.RawStdEncoding.EncodeToString([]byte("client_secret")),
			},
			wantErr: true,
		},
	}

	for _, tc := range testCases {
		// create a local copy of "tc" to allow concurrent access within tests to the different items of testCases,
		// otherwise it would be like a moving pointer while tests run in parallel
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			env := setupTestEnv(t, false, false, false)

			if tc.setup != nil {
				tc.setup(env)
			}

			actual, err := env.service.decryptSecrets(context.Background(), tc.settings)

			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.want, actual)

			env.secrets.AssertExpectations(t)
		})
	}
}

func Test_ProviderService(t *testing.T) {
	tests := []struct {
		name                  string
		isLicenseEnabled      bool
		expectedProvidersList []string
		strategiesLength      int
	}{
		{
			name:             "should return all OAuth providers but not SAML because the licensing feature is not enabled",
			isLicenseEnabled: false,
			expectedProvidersList: []string{
				"github",
				"gitlab",
				"google",
				"generic_oauth",
				"grafana_com",
				"azuread",
				"okta",
			},
			strategiesLength: 2,
		},
		{
			name:             "should return all fallback strategies and it should return all OAuth providers and SAML because the licensing feature is enabled and the provider is setup",
			isLicenseEnabled: true,
			expectedProvidersList: []string{
				"github",
				"gitlab",
				"google",
				"generic_oauth",
				"grafana_com",
				"azuread",
				"okta",
				"saml",
			},
			strategiesLength: 3,
		},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			env := setupTestEnv(t, tc.isLicenseEnabled, true, false)

			require.Equal(t, tc.expectedProvidersList, env.service.providersList)
			require.Equal(t, tc.strategiesLength, len(env.service.fbStrategies))
		})
	}
}

func setupTestEnv(t *testing.T, isLicensingEnabled, keepFallbackStratergies bool, ldapEnabled bool) testEnv {
	t.Helper()

	store := ssosettingstests.NewFakeStore()
	fallbackStrategy := ssosettingstests.NewFakeFallbackStrategy()
	secrets := secretsFakes.NewMockService(t)
	accessControl := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	reloadables := make(map[string]ssosettings.Reloadable)

	fallbackStrategy.ExpectedIsMatch = true

	iniFile, _ := ini.Load([]byte(""))

	configurableProviders := map[string]bool{
		"github":        true,
		"okta":          true,
		"azuread":       true,
		"google":        true,
		"generic_oauth": true,
		"gitlab":        true,
	}

	cfg := &setting.Cfg{
		SSOSettingsConfigurableProviders: configurableProviders,
		Raw:                              iniFile,
	}

	licensing := licensingtest.NewFakeLicensing()
	licensing.On("FeatureEnabled", "saml").Return(isLicensingEnabled)

	features := make([]any, 0)
	if ldapEnabled {
		features = append(features, featuremgmt.FlagSsoSettingsLDAP)
	}
	featureManager := featuremgmt.WithManager(features...)

	svc := ProvideService(
		cfg,
		&dbtest.FakeDB{},
		accessControl,
		routing.NewRouteRegister(),
		featureManager,
		secretsFakes.NewMockService(t),
		&usagestats.UsageStatsMock{},
		prometheus.NewRegistry(),
		&setting.OSSImpl{Cfg: cfg},
		licensing,
	)

	// overriding values for exposed fields
	svc.store = store
	if !keepFallbackStratergies {
		svc.fbStrategies = []ssosettings.FallbackStrategy{
			fallbackStrategy,
		}
	}
	svc.secrets = secrets
	svc.reloadables = reloadables

	return testEnv{
		cfg:              cfg,
		service:          svc,
		store:            store,
		ac:               accessControl,
		fallbackStrategy: fallbackStrategy,
		secrets:          secrets,
		reloadables:      reloadables,
	}
}

type testEnv struct {
	cfg              *setting.Cfg
	service          *Service
	store            *ssosettingstests.FakeStore
	ac               accesscontrol.AccessControl
	fallbackStrategy *ssosettingstests.FakeFallbackStrategy
	secrets          *secretsFakes.MockService
	reloadables      map[string]ssosettings.Reloadable
}
