package connectors

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/login/social"
)

func TestCreateOAuthInfoFromKeyValues_WorkloadIdentityTokenFile(t *testing.T) {
	testCases := []struct {
		name     string
		env      string
		settings map[string]any
		expected string
	}{
		{
			name: "takes the configured path over the Azure environment",
			env:  "/from/env/azure-identity-token",
			settings: map[string]any{
				"client_authentication":        social.WorkloadIdentity,
				"workload_identity_token_file": "/configured/path",
			},
			expected: "/configured/path",
		},
		{
			name: "falls back to the Azure environment when no path is configured",
			env:  "/from/env/azure-identity-token",
			settings: map[string]any{
				"client_authentication":        social.WorkloadIdentity,
				"workload_identity_token_file": "",
			},
			expected: "/from/env/azure-identity-token",
		},
		{
			name: "stays empty when neither the settings nor the Azure environment provide a path",
			env:  "",
			settings: map[string]any{
				"client_authentication":        social.WorkloadIdentity,
				"workload_identity_token_file": "",
			},
			expected: "",
		},
		{
			name: "leaves other client authentication methods alone",
			env:  "/from/env/azure-identity-token",
			settings: map[string]any{
				"client_authentication":        social.ClientSecretPost,
				"workload_identity_token_file": "",
			},
			expected: "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(azureFederatedTokenFileEnv, tc.env)

			info, err := CreateOAuthInfoFromKeyValues(tc.settings)
			require.NoError(t, err)
			require.Equal(t, tc.expected, info.WorkloadIdentityTokenFile)
		})
	}
}
