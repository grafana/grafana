package resources

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestWatchManifests(t *testing.T) {
	t.Run("does nothing without a router", func(t *testing.T) {
		watcher, err := WatchManifests(NewSupportedResourceSet(nil), nil, resource.ManifestWatcherConfig{})

		require.NoError(t, err)
		require.NotNil(t, watcher)
	})
}
