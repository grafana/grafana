package legacy_storage

import (
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/alerting/definition"

	policy_exports "github.com/grafana/grafana/pkg/services/ngalert/api/test-data/policy-exports"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func TestConfigRevision_ResetUserDefinedRoute(t *testing.T) {
	rev := testConfig()
	original := rev.Config.AlertmanagerConfig.Route
	newRoute := definitions.Route{
		Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
	}
	defaultCfg := definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: &newRoute,
			},
		},
	}
	err := rev.ResetUserDefinedRoute(&defaultCfg)
	assert.NoError(t, err)

	assert.Equal(t, &newRoute, rev.Config.AlertmanagerConfig.Route)
	assert.NotEqual(t, original, rev.Config.AlertmanagerConfig.Route)

	// Now we try with a default config that has an invalid receiver.
	// We don't fail the reset if the new default receiver exists in the default config,
	// instead we create it as per the definition.
	name := "deleted_default"
	newRoute = definitions.Route{
		Receiver: name,
	}
	defaultCfg = definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: &definitions.Route{
					Receiver: name,
				},
			},
			Receivers: []*definition.PostableApiReceiver{
				{
					Receiver: config.Receiver{
						Name: name,
					},
				},
			},
		},
	}
	err = rev.ResetUserDefinedRoute(&defaultCfg)
	assert.NoError(t, err)

	assert.Equal(t, &newRoute, rev.Config.AlertmanagerConfig.Route)
	assert.NotEqual(t, original, rev.Config.AlertmanagerConfig.Route)

	assert.Contains(t, rev.GetReceiversNames(), name)
}

// The intention here isn't to be exhaustive; route validation is done at length elsewhere. Instead, we hit the main
// sources of validation issues to ensure it's calling the correct code-paths.
func TestConfigRevision_ValidateRoute(t *testing.T) {
	t.Run("valid route passes validation", func(t *testing.T) {
		rev := testConfig()
		validRoute := definitions.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
		}
		err := rev.ValidateRoute(validRoute)
		require.NoError(t, err)
	})

	t.Run("fails route structural validation", func(t *testing.T) {
		rev := testConfig()

		// Empty receiver is invalid for root.
		invalid := definitions.Route{
			Receiver: "",
		}

		err := rev.ValidateRoute(invalid)
		require.ErrorContains(t, err, "default receiver")
	})

	t.Run("fails when receiver does not exist", func(t *testing.T) {
		rev := testConfig()

		invalid := definitions.Route{
			Receiver: "missing-receiver",
		}

		err := rev.ValidateRoute(invalid)
		require.ErrorContains(t, err, "missing-receiver")
	})

	t.Run("fails when mute time interval does not exist", func(t *testing.T) {
		rev := testConfig()

		invalid := definitions.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
			Routes: []*definitions.Route{
				{
					MuteTimeIntervals: []string{"missing-interval"},
				},
			},
		}

		err := rev.ValidateRoute(invalid)
		require.ErrorContains(t, err, "missing-interval")
	})

	t.Run("fails when active time interval does not exist", func(t *testing.T) {
		rev := testConfig()

		invalid := definitions.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
			Routes: []*definitions.Route{
				{
					ActiveTimeIntervals: []string{"missing-interval"},
				},
			},
		}

		err := rev.ValidateRoute(invalid)
		require.ErrorContains(t, err, "missing-interval")
	})
}

func testConfig() *ConfigRevision {
	rev := &ConfigRevision{
		Config:                 policy_exports.Config(),
		managedRoutesSupported: true,
	}
	return rev
}
