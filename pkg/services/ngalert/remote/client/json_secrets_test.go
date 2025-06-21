package client

import (
	"encoding/json"
	"fmt"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/config"
	commoncfg "github.com/prometheus/common/config"
	"github.com/stretchr/testify/require"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func TestMarshalWithSecrets(t *testing.T) {
	u := "https://grafana.com/webhook"
	testURL, err := url.Parse(u)
	require.NoError(t, err)

	// stdlib json escapes < and > characters,
	// so just marshal the placeholder string to have the same value.
	maskedSecretBytes, err := json.Marshal("<secret>")
	require.NoError(t, err)
	maskedSecret := string(maskedSecretBytes)

	cfg := &apimodels.PostableUserConfig{
		AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
			Receivers: []*apimodels.PostableApiReceiver{
				{
					Receiver: config.Receiver{
						Name: "test-receiver",
						WebhookConfigs: []*config.WebhookConfig{
							{
								URL: &config.SecretURL{URL: testURL},
								HTTPConfig: &commoncfg.HTTPClientConfig{
									BasicAuth: &commoncfg.BasicAuth{
										Username: "user",
										Password: commoncfg.Secret("password"),
									},
									BearerToken: commoncfg.Secret("bearer-token-secret"),
									Authorization: &commoncfg.Authorization{
										Type:        "Bearer",
										Credentials: commoncfg.Secret("auth-credentials-secret"),
									},
								},
							},
						},
						EmailConfigs: []*config.EmailConfig{
							{
								To:           "test@example.com",
								From:         "alerts@example.com",
								AuthUsername: "smtp-user",
								AuthPassword: config.Secret("smtp-password"),
								AuthSecret:   config.Secret("smtp-secret"),
							},
						},
					},
				},
			},
		},
	}

	standardJSON, err := json.Marshal(cfg)
	require.NoError(t, err)

	plainJSON, err := MarshalWithSecrets(cfg)
	require.NoError(t, err)

	require.True(t, json.Valid(standardJSON))
	require.Contains(t, string(standardJSON), maskedSecret)

	require.True(t, json.Valid(plainJSON))

	require.Contains(t, string(plainJSON), "password")
	require.Contains(t, string(plainJSON), "bearer-token-secret")
	require.Contains(t, string(plainJSON), "auth-credentials-secret")
	require.Contains(t, string(plainJSON), "smtp-password")
	require.Contains(t, string(plainJSON), "smtp-secret")
	require.Contains(t, string(plainJSON), u)
}

func TestSecretTypeMarshaling(t *testing.T) {
	// stdlib json escapes < and > characters,
	// so just marshal the placeholder string to have the same value.
	maskedSecretBytes, err := json.Marshal("<secret>")
	require.NoError(t, err)
	maskedSecret := string(maskedSecretBytes)

	tests := []struct {
		name           string
		secret         interface{}
		expectStandard string
		expectPlain    string
	}{
		{
			name:           "alertmanager config secret",
			secret:         config.Secret("my-secret"),
			expectStandard: maskedSecret,
			expectPlain:    `"my-secret"`,
		},
		{
			name:           "common config secret",
			secret:         commoncfg.Secret("common-secret"),
			expectStandard: maskedSecret,
			expectPlain:    `"common-secret"`,
		},
		{
			name:           "empty alertmanager secret",
			secret:         config.Secret(""),
			expectStandard: maskedSecret,
			expectPlain:    `""`,
		},
		{
			name:           "empty common secret",
			secret:         commoncfg.Secret(""),
			expectStandard: `""`, // commoncfg.Secret returns empty string for empty values
			expectPlain:    `""`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			standard, err := json.Marshal(tt.secret)
			require.NoError(t, err)
			require.Equal(t, tt.expectStandard, string(standard))

			plain, err := MarshalWithSecrets(tt.secret)
			require.NoError(t, err)
			require.Equal(t, tt.expectPlain, string(plain))
		})
	}
}

func TestSecretURLTypeMarshaling(t *testing.T) {
	u := "https://grafana.com/webhook"
	testURL, err := url.Parse(u)
	require.NoError(t, err)

	// stdlib json escapes < and > characters,
	// so just marshal the placeholder string to have the same value.
	maskedSecretBytes, err := json.Marshal("<secret>")
	require.NoError(t, err)
	maskedSecret := string(maskedSecretBytes)

	tests := []struct {
		name           string
		secretURL      config.SecretURL
		expectStandard string
		expectPlain    string
	}{
		{
			name:           "non-empty secret URL",
			secretURL:      config.SecretURL{URL: testURL},
			expectStandard: maskedSecret,
			expectPlain:    fmt.Sprintf(`"%s"`, u),
		},
		{
			name:           "empty secret URL",
			secretURL:      config.SecretURL{},
			expectStandard: maskedSecret,
			expectPlain:    `null`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			standard, err := json.Marshal(tt.secretURL)
			require.NoError(t, err)
			require.Equal(t, tt.expectStandard, string(standard))

			plain, err := MarshalWithSecrets(tt.secretURL)
			require.NoError(t, err)
			require.Equal(t, tt.expectPlain, string(plain))
		})
	}
}
