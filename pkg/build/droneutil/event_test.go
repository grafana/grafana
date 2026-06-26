package droneutil_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/build/droneutil"
)

func TestGetDroneEvent(t *testing.T) {
	t.Run("Should return the Drone Event", func(t *testing.T) {
		env := []string{"DRONE_BUILD_EVENT=pull_request"}
		droneEvent, err := droneutil.GetDroneEvent(env)
		require.NoError(t, err)
		require.Equal(t, droneEvent, "pull_request")
	})
	t.Run("Should return error, Drone Event env var is missing", func(t *testing.T) {
		droneEvent, err := droneutil.GetDroneEvent([]string{})
		require.Error(t, err)
		require.Empty(t, droneEvent)
	})
}

func TestLookup(t *testing.T) {
	env := []string{"", "EXAMPLE_KEY=value", "EXAMPLE_KEY"}
	t.Run("A valid lookup should return a string and no error", func(t *testing.T) {
		val, ok := droneutil.Lookup(env, "EXAMPLE_KEY")
		require.True(t, ok)
		require.Equal(t, val, "value")
	})

	t.Run("An invalid lookup should return an error", func(t *testing.T) {
		_, ok := droneutil.Lookup(env, "EXAMPLE_KEY_DOES_NOT_EXIST")
		require.False(t, ok)
	})
}
