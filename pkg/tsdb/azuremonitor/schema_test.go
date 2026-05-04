package azuremonitor

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsLogsTableRouting(t *testing.T) {
	t.Run("logs table detected", func(t *testing.T) {
		require.True(t, isLogsTable("logs-MyWorkspace"))
	})
	t.Run("metrics table not detected as logs", func(t *testing.T) {
		require.False(t, isLogsTable("microsoft-compute-virtualmachines"))
	})
	t.Run("empty string not logs", func(t *testing.T) {
		require.False(t, isLogsTable(""))
	})
}

func TestStripTableParameterValuesWithLogsPrefix(t *testing.T) {
	t.Run("strips suffix after underscore", func(t *testing.T) {
		require.Equal(t, "logs-MyWorkspace", stripTableParameterValues("logs-MyWorkspace_sub123"))
	})
	t.Run("no underscore returns as-is", func(t *testing.T) {
		require.Equal(t, "logs-MyWorkspace", stripTableParameterValues("logs-MyWorkspace"))
	})
}

func TestCompositeSchemaConstruction(t *testing.T) {
	m := &metricsSchema{}
	l := &logAnalyticsSchema{}
	c := newCompositeSchema(m, l)
	require.NotNil(t, c)
	require.Equal(t, m, c.metrics)
	require.Equal(t, l, c.logs)
}
