package notifier

import (
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func TestNewNotificationSettingsValidator_Routes(t *testing.T) {
	baseConfig := func() *v1.AMConfigV1 {
		return &v1.AMConfigV1{
			AlertmanagerConfig: v1.PostableApiAlertingConfig{
				Config: v1.Config{
					Route: &v1.Route{Receiver: "default"},
				},
				Receivers: []*v1.PostableApiReceiver{
					{Receiver: definition.Receiver{Name: "default"}},
				},
			},
		}
	}

	tests := []struct {
		name        string
		mutate      func(cfg *v1.AMConfigV1)
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
			mutate: func(cfg *v1.AMConfigV1) {
				cfg.ManagedRoutes = v1.ManagedRoutes{"custom-route": nil}
			},
			policy:      "custom-route",
			expectError: false,
		},
		{
			name: "second managed route is available",
			mutate: func(cfg *v1.AMConfigV1) {
				cfg.ManagedRoutes = v1.ManagedRoutes{
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
			mutate: func(cfg *v1.AMConfigV1) {
				cfg.ExtraConfigs = []v1.ExtraConfiguration{
					{Identifier: "extra-1"},
				}
			},
			policy:      "extra-1",
			expectError: false,
		},
		{
			name: "only first extra config is added as route",
			mutate: func(cfg *v1.AMConfigV1) {
				cfg.ExtraConfigs = []v1.ExtraConfiguration{
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
			mutate: func(cfg *v1.AMConfigV1) {
				cfg.ManagedRoutes = v1.ManagedRoutes{"managed-1": nil}
				cfg.ExtraConfigs = []v1.ExtraConfiguration{
					{Identifier: "extra-1"},
				}
			},
			policy:      "managed-1",
			expectError: false,
		},
		{
			name: "extra config route available alongside managed routes",
			mutate: func(cfg *v1.AMConfigV1) {
				cfg.ManagedRoutes = v1.ManagedRoutes{"managed-1": nil}
				cfg.ExtraConfigs = []v1.ExtraConfiguration{
					{Identifier: "extra-1"},
				}
			},
			policy:      "extra-1",
			expectError: false,
		},
		{
			name: "unknown route fails even when other sources exist",
			mutate: func(cfg *v1.AMConfigV1) {
				cfg.ManagedRoutes = v1.ManagedRoutes{"managed-1": nil}
				cfg.ExtraConfigs = []v1.ExtraConfiguration{
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
