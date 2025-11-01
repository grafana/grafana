package mocks

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
)

// Mocks for auth checks

type mockSSOSettingsService struct {
	ssosettings.Service
}

// ACTUALLY USED by authchecks
func (m *mockSSOSettingsService) ListWithRedactedSecrets(ctx context.Context) ([]*models.SSOSettings, error) {
	return []*models.SSOSettings{
		{
			ID:       "google-oauth",
			Provider: "google",
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "google-client-id",
				"client_secret": "[REDACTED]",
				"scopes":        []string{"openid", "email", "profile"},
			},
		},
		{
			ID:       "github-oauth",
			Provider: "github",
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "github-client-id",
				"client_secret": "[REDACTED]",
				"scopes":        []string{"user:email"},
			},
		},
		{
			ID:       "azure-ad",
			Provider: "azuread",
			Settings: map[string]any{
				"enabled":       false,
				"client_id":     "azure-client-id",
				"client_secret": "[REDACTED]",
				"tenant_id":     "azure-tenant-id",
			},
		},
	}, nil
}

// ACTUALLY USED by authchecks
func (m *mockSSOSettingsService) GetForProviderWithRedactedSecrets(ctx context.Context, provider string) (*models.SSOSettings, error) {
	// Return SSO setting based on provider
	switch provider {
	case "google":
		return &models.SSOSettings{
			ID:       "google-oauth",
			Provider: "google",
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "google-client-id",
				"client_secret": "[REDACTED]",
				"scopes":        []string{"openid", "email", "profile"},
			},
		}, nil
	case "github":
		return &models.SSOSettings{
			ID:       "github-oauth",
			Provider: "github",
			Settings: map[string]any{
				"enabled":       true,
				"client_id":     "github-client-id",
				"client_secret": "[REDACTED]",
				"scopes":        []string{"user:email"},
			},
		}, nil
	case "azuread":
		return &models.SSOSettings{
			ID:       "azure-ad",
			Provider: "azuread",
			Settings: map[string]any{
				"enabled":       false,
				"client_id":     "azure-client-id",
				"client_secret": "[REDACTED]",
				"tenant_id":     "azure-tenant-id",
			},
		}, nil
	default:
		return nil, nil
	}
}
