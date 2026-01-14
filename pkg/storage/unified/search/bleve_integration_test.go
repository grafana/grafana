package search

import (
	"context"
	"testing"

	index "github.com/blevesearch/bleve_index_api"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	unitest "github.com/grafana/grafana/pkg/storage/unified/testing"
)

func TestBleveSearchBackend(t *testing.T) {
	// Run the search backend test suite
	unitest.RunSearchBackendTest(t, func(ctx context.Context) resource.SearchBackend {
		tempDir := t.TempDir()

		// Create a new bleve backend
		backend, err := NewBleveBackend(BleveOptions{
			Root:          tempDir,
			FileThreshold: 5,
			ScoringModel:  index.BM25Scoring,
		}, nil)
		require.NoError(t, err)
		require.NotNil(t, backend)

		t.Cleanup(backend.Stop)

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
	}, nil)
	require.NoError(t, err)
	require.NotNil(t, backend)

	t.Cleanup(backend.Stop)

	unitest.BenchmarkSearchBackend(t, backend, opts)
}

func BenchmarkScoringModels(b *testing.B) {
	models := []string{index.TFIDFScoring, index.BM25Scoring}

	for _, model := range models {
		b.Run(model, func(b *testing.B) {
			tempDir := b.TempDir()

			backend, err := NewBleveBackend(BleveOptions{
				Root:         tempDir,
				ScoringModel: model,
			}, nil)
			require.NoError(b, err)
			require.NotNil(b, backend)

			b.Cleanup(backend.Stop)

			opts := &unitest.BenchmarkOptions{
				NumResources:     1000,
				Concurrency:      4,
				NumNamespaces:    10,
				NumGroups:        10,
				NumResourceTypes: 10,
			}

			unitest.BenchmarkSearchBackend(b, backend, opts)
		})
	}
}
