package search

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestUpdateIndexSizeMetric(t *testing.T) {
	for _, mode := range []os.FileMode{0o700, 0o000} {
		t.Run(mode.String(), func(t *testing.T) {
			if mode == 0 && os.Geteuid() == 0 {
				t.Skip("root can read directories without read permissions")
			}

			root := t.TempDir()
			lostFound := filepath.Join(root, "lost+found")
			require.NoError(t, os.Mkdir(lostFound, 0o700))
			require.NoError(t, os.WriteFile(filepath.Join(lostFound, "recovered"), []byte("not an index"), 0o600))
			require.NoError(t, os.Chmod(lostFound, mode))
			t.Cleanup(func() {
				// Directory traversal must be restored so TempDir cleanup can remove its contents.
				require.NoError(t, os.Chmod(lostFound, 0o700)) //nolint:gosec // G302: Owner-only directory permissions are required for cleanup.
			})

			// Only the filesystem's top-level recovery directory should be skipped.
			index := filepath.Join(root, "index", "lost+found")
			require.NoError(t, os.MkdirAll(index, 0o700))
			require.NoError(t, os.WriteFile(filepath.Join(index, "data"), []byte("index data"), 0o600))

			logger := &logtest.Fake{}
			backend := &bleveBackend{
				log:          logger,
				indexMetrics: resource.ProvideIndexMetrics(nil),
			}
			backend.indexMetrics.IndexSize.Set(99)
			backend.updateIndexSizeMetric(context.Background(), root)
			require.Equal(t, float64(len("index data")), testutil.ToFloat64(backend.indexMetrics.IndexSize))
			require.Zero(t, logger.ErrorLogs.Calls)
		})
	}

	t.Run("regular file named lost+found is counted", func(t *testing.T) {
		root := t.TempDir()
		require.NoError(t, os.WriteFile(filepath.Join(root, "lost+found"), []byte("index data"), 0o600))
		backend := &bleveBackend{
			log:          &logtest.Fake{},
			indexMetrics: resource.ProvideIndexMetrics(nil),
		}
		backend.updateIndexSizeMetric(context.Background(), root)
		require.Equal(t, float64(len("index data")), testutil.ToFloat64(backend.indexMetrics.IndexSize))
	})

	t.Run("unrelated walk errors preserve the previous value", func(t *testing.T) {
		logger := &logtest.Fake{}
		backend := &bleveBackend{
			log:          logger,
			indexMetrics: resource.ProvideIndexMetrics(nil),
		}
		backend.indexMetrics.IndexSize.Set(99)
		backend.updateIndexSizeMetric(context.Background(), filepath.Join(t.TempDir(), "missing"))
		require.Equal(t, 99.0, testutil.ToFloat64(backend.indexMetrics.IndexSize))
		require.Equal(t, 1, logger.ErrorLogs.Calls)
	})
}
