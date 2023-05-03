package env_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/build/env"
)

func TestLookup(t *testing.T) {
	values := []string{"ENV_1=a", "ENV_2=b", "ENV_3=c", "ENV_4_TEST="}

	{
		v, ok := env.Lookup("ENV_1", values)
		require.Equal(t, v, "a")
		require.True(t, ok)
	}

	{
		v, ok := env.Lookup("ENV_2", values)
		require.Equal(t, v, "b")
		require.True(t, ok)
	}

	{
		v, ok := env.Lookup("ENV_3", values)
		require.Equal(t, v, "c")
		require.True(t, ok)
	}

	{
		v, ok := env.Lookup("ENV_4_TEST", values)
		require.Equal(t, v, "")
		require.True(t, ok)
	}

	{
		v, ok := env.Lookup("NOT_THERE", values)
		require.Equal(t, v, "")
		require.False(t, ok)
	}
}
