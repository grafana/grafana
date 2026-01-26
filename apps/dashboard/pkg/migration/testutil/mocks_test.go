package testutil

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigurableDataSourceProvider(t *testing.T) {
	ctx := context.Background()

	t.Run("standard test config", func(t *testing.T) {
		provider := NewDataSourceProvider(StandardTestConfig)
		dataSources := provider.GetDataSourceInfo(ctx)

		require.Len(t, dataSources, 9)

		// Verify standard test configuration
		defaultDS := dataSources[0]
		assert.True(t, defaultDS.Default)
		assert.Equal(t, "default-ds-uid", defaultDS.UID)
		assert.Equal(t, "prometheus", defaultDS.Type)
		assert.Equal(t, "v1", defaultDS.APIVersion)
	})

	t.Run("dev dashboard config", func(t *testing.T) {
		provider := NewDataSourceProvider(DevDashboardConfig)
		dataSources := provider.GetDataSourceInfo(ctx)

		require.Len(t, dataSources, 6)

		// Verify dev dashboard configuration
		defaultDS := dataSources[0]
		assert.True(t, defaultDS.Default)
		assert.Equal(t, "testdata-type-uid", defaultDS.UID)
		assert.Equal(t, "grafana-testdata-datasource", defaultDS.Type)
		assert.Equal(t, "v1", defaultDS.APIVersion)

		// Verify testdata without apiVersion
		testDataDS := dataSources[1]
		assert.False(t, testDataDS.Default)
		assert.Equal(t, "testdata", testDataDS.UID)
		assert.Equal(t, "grafana-testdata-datasource", testDataDS.Type)
		assert.Equal(t, "", testDataDS.APIVersion) // No apiVersion for frontend testdata
	})

	t.Run("equivalent configurations", func(t *testing.T) {
		// Test that different ways of creating providers return equivalent results
		standardProvider1 := NewDataSourceProvider(StandardTestConfig)
		standardProvider2 := NewDataSourceProvider(StandardTestConfig)
		devProvider1 := NewDataSourceProvider(DevDashboardConfig)
		devProvider2 := NewDataSourceProvider(DevDashboardConfig)

		standardDS1 := standardProvider1.GetDataSourceInfo(ctx)
		standardDS2 := standardProvider2.GetDataSourceInfo(ctx)
		devDS1 := devProvider1.GetDataSourceInfo(ctx)
		devDS2 := devProvider2.GetDataSourceInfo(ctx)

		require.Len(t, standardDS1, 9)
		require.Len(t, standardDS2, 9)
		require.Len(t, devDS1, 6)
		require.Len(t, devDS2, 6)

		// Verify equivalent configurations return the same data
		assert.Equal(t, standardDS1[0].UID, standardDS2[0].UID)
		assert.Equal(t, devDS1[0].UID, devDS2[0].UID)
		assert.Equal(t, "default-ds-uid", standardDS1[0].UID)
		assert.Equal(t, "testdata-type-uid", devDS1[0].UID)
	})

	t.Run("unknown config defaults to standard", func(t *testing.T) {
		provider := NewDataSourceProvider("unknown-config")
		dataSources := provider.GetDataSourceInfo(ctx)

		require.Len(t, dataSources, 9)

		// Should default to standard configuration
		defaultDS := dataSources[0]
		assert.Equal(t, "default-ds-uid", defaultDS.UID)
		assert.Equal(t, "prometheus", defaultDS.Type)
	})
}

// TestModernUsageExample demonstrates how to use the new configurable approach
func TestModernUsageExample(t *testing.T) {
	// Example of modern usage in migration tests
	t.Run("modern test setup", func(t *testing.T) {
		// Create provider with specific configuration
		provider := NewDataSourceProvider(StandardTestConfig)

		// Use in migration initialization (example)
		dataSources := provider.GetDataSourceInfo(context.Background())

		// Verify we got the expected configuration
		require.NotEmpty(t, dataSources)
		assert.Equal(t, "prometheus", dataSources[0].Type)
	})

	t.Run("dev dashboard test setup", func(t *testing.T) {
		// For dev dashboard tests
		provider := NewDataSourceProvider(DevDashboardConfig)

		dataSources := provider.GetDataSourceInfo(context.Background())

		// Verify we got the dev dashboard configuration
		require.NotEmpty(t, dataSources)
		assert.Equal(t, "grafana-testdata-datasource", dataSources[0].Type)
	})
}
