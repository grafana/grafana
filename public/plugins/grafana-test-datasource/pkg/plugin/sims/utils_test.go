package sims

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSimulationUtils(t *testing.T) {
	a := map[string]interface{}{
		"hello":  "world",
		"bool":   true,
		"number": 10,
	}

	err := updateConfigObjectFromJSON(&a, map[string]interface{}{
		"bool":   false,
		"number": 5,
	})
	require.NoError(t, err)

	cfg, err := json.MarshalIndent(a, "", "  ")
	require.NoError(t, err)
	require.JSONEq(t, `{
		"hello": "world", 
		"bool": false, 
		"number": 5
	}`, string(cfg))
}
