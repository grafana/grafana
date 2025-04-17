package search

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	unitest "github.com/grafana/grafana/pkg/storage/unified/testing"
)

func TestBleveSearchBackend(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// Run the search backend test suite
	unitest.RunSearchBackendTest(t, func(ctx context.Context) resource.SearchBackend {
		tempDir := t.TempDir()

		// Create a new bleve backend
		backend, err := NewBleveBackend(BleveOptions{
			Root:          tempDir,
			FileThreshold: 5,
		}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering), nil)
		require.NoError(t, err)
		require.NotNil(t, backend)

		return backend
	}, &unitest.TestOptions{
		NSPrefix: "bleve-test",
	})
}

func TestSearchBackendBenchmark(t *testing.T) {
	opts := &unitest.BenchmarkOptions{
		NumResources:     10000,
		Concurrency:      1, // For now we only want to test the write throughput
		NumNamespaces:    1,
		NumGroups:        1,
		NumResourceTypes: 1,
	}
	tempDir := t.TempDir()

	// Create a new bleve backend
	backend, err := NewBleveBackend(BleveOptions{
		Root: tempDir,
	}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering), nil)
	require.NoError(t, err)
	require.NotNil(t, backend)

	unitest.BenchmarkSearchBackend(t, backend, opts)
}
