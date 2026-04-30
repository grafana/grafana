package notifier

import (
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestNewNotificationSettingsValidator_Routes(t *testing.T) {
	baseConfig := func() *definitions.PostableUserConfig {
		return &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "default"},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{Receiver: definition.Receiver{Name: "default"}},
				},
			},
		}
	}

	tests := []struct {
		name        string
		mutate      func(cfg *definitions.PostableUserConfig)
		policy      string
		expectError bool
		errorType   error // nil means just check expectError
	}{
		{
			name:        "default routing tree is always available but PolicyRouting rejects it",
			policy:      models.DefaultRoutingTreeName,
			expectError: true, // PolicyRouting.Validate rejects explicitly pointing to default tree
		},
		{
			name: "managed route is available",
			mutate: func(cfg *definitions.PostableUserConfig) {
				cfg.ManagedRoutes = definitions.ManagedRoutes{"custom-route": nil}
			},
			policy:      "custom-route",
			expectError: false,
		},
		{
			name: "second managed route is available",
			mutate: func(cfg *definitions.PostableUserConfig) {
				cfg.ManagedRoutes = definitions.ManagedRoutes{
					"route-a": nil,
					"route-b": nil,
				}
			},
			policy:      "route-b",
			expectError: false,
		},
		{
			name:        "unknown route returns ErrorRouteDoesNotExist",
			policy:      "does-not-exist",
			expectError: true,
			errorType:   ErrorRouteDoesNotExist{},
		},
		{
			name: "first extra config identifier is available",
			mutate: func(cfg *definitions.PostableUserConfig) {
				cfg.ExtraConfigs = []definitions.ExtraConfiguration{
					{Identifier: "extra-1"},
				}
			},
			policy:      "extra-1",
			expectError: false,
		},
		{
			name: "only first extra config is added as route",
			mutate: func(cfg *definitions.PostableUserConfig) {
				cfg.ExtraConfigs = []definitions.ExtraConfiguration{
					{Identifier: "extra-1"},
					{Identifier: "extra-2"},
				}
			},
			policy:      "extra-2",
			expectError: true,
			errorType:   ErrorRouteDoesNotExist{},
		},
		{
			name:        "empty extra configs does not add routes",
			policy:      "extra-route",
			expectError: true,
			errorType:   ErrorRouteDoesNotExist{},
		},
		{
			name: "managed route available alongside extra config",
			mutate: func(cfg *definitions.PostableUserConfig) {
				cfg.ManagedRoutes = definitions.ManagedRoutes{"managed-1": nil}
				cfg.ExtraConfigs = []definitions.ExtraConfiguration{
					{Identifier: "extra-1"},
				}
			},
			policy:      "managed-1",
			expectError: false,
		},
		{
			name: "extra config route available alongside managed routes",
			mutate: func(cfg *definitions.PostableUserConfig) {
				cfg.ManagedRoutes = definitions.ManagedRoutes{"managed-1": nil}
				cfg.ExtraConfigs = []definitions.ExtraConfiguration{
					{Identifier: "extra-1"},
				}
			},
			policy:      "extra-1",
			expectError: false,
		},
		{
			name: "unknown route fails even when other sources exist",
			mutate: func(cfg *definitions.PostableUserConfig) {
				cfg.ManagedRoutes = definitions.ManagedRoutes{"managed-1": nil}
				cfg.ExtraConfigs = []definitions.ExtraConfiguration{
					{Identifier: "extra-1"},
				}
			},
			policy:      "unknown",
			expectError: true,
			errorType:   ErrorRouteDoesNotExist{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := baseConfig()
			if tc.mutate != nil {
				tc.mutate(cfg)
			}
			v := NewNotificationSettingsValidator(cfg)

			err := v.Validate(models.NotificationSettings{
				PolicyRouting: &models.PolicyRouting{Policy: tc.policy},
			})

			if tc.expectError {
				require.Error(t, err)
				if tc.errorType != nil {
					assert.ErrorAs(t, err, &tc.errorType)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}
