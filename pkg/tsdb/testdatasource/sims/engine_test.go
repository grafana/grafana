package sims

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCoreSimulationRegistry(t *testing.T) {
	sims, err := NewSimulationEngine()
	require.NoError(t, err)
	v, err := sims.Lookup(simulationState{
		Key: simulationKey{
			Type:   "flight",
			TickHZ: 1,
		},
		Config: map[string]interface{}{
			"period": 100,
			"radius": 0.05,
		},
	})
	require.NoError(t, err)

	cfg, err := json.MarshalIndent(v.GetState(), "", "  ")
	require.NoError(t, err)
	require.JSONEq(t, `{
		"key": {
			"type": "flight",
			"tick": 1
		},
		"config": {
			"centerLat":37.83, 
			"centerLng":-122.42487, 
			"altitudeMax":400,
			"altitudeMin":350, 
			"period":100, 
			"radius":0.05
		}
	}`, string(cfg))

	path := v.GetState().Key.String()
	found, err := sims.getSimFromPath("sim/" + path)
	require.NoError(t, err)
	require.Equal(t, v, found)

	found, err = sims.getSimFromPath("/sim/" + path)
	require.NoError(t, err)
	require.Equal(t, v, found)

	found, err = sims.getSimFromPath(path)
	require.NoError(t, err)
	require.Equal(t, v, found)

	// In valid paths
	_, err = sims.getSimFromPath("flight/1.00hz")
	require.Error(t, err)

	_, err = sims.getSimFromPath("flight/1")
	require.Error(t, err)

	_, err = sims.getSimFromPath("flight/1/")
	require.Error(t, err)
}
