package config

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateMemoryLimit(t *testing.T) {
	t.Run("accepts values the Go runtime starts with", func(t *testing.T) {
		for _, v := range []string{"off", "1B", "1024B", "512KiB", "512MiB", "2GiB", "0512MiB", "8388607TiB", "9223372036854775807B"} {
			t.Run(v, func(t *testing.T) {
				require.NoError(t, ValidateMemoryLimit(v))
			})
		}
	})

	t.Run("rejects values the Go runtime aborts on or that disable the heap", func(t *testing.T) {
		for _, v := range []string{"", "0", "0GiB", "1024", "-1GiB", "+1GiB", "1.5GiB", "12GB", "12G", "1gib", "1 GiB", " 1GiB", "Off", "8388608TiB", "9223372036854775808B", "99999999999999999999GiB"} {
			t.Run(v, func(t *testing.T) {
				require.Error(t, ValidateMemoryLimit(v))
			})
		}
	})
}

func TestPluginSettings_MemoryLimit(t *testing.T) {
	ps := PluginSettings{
		"with-limit": {"memory_limit": "1GiB"},
		"mixed-case": {"Memory_Limit": "2GiB"},
		"both-cases": {"memory_limit": "1GiB", "Memory_Limit": "2GiB"},
		"without":    {"path": "/plugins"},
	}
	require.Equal(t, "1GiB", ps.MemoryLimit("with-limit"))
	require.Equal(t, "2GiB", ps.MemoryLimit("mixed-case"))
	require.Equal(t, "", ps.MemoryLimit("without"))
	require.Equal(t, "", ps.MemoryLimit("unknown"))
	for range 20 {
		require.Equal(t, "2GiB", ps.MemoryLimit("both-cases"), "duplicate keys must resolve to the same value on every call")
	}
}
