package kind

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/store/kind/dummy"
)

func TestKindRegistry(t *testing.T) {
	registry := NewKindRegistry()
	err := registry.Register(dummy.GetObjectKindInfo(), dummy.GetObjectSummaryBuilder())
	require.NoError(t, err)

	// Check playlist exists
	info, err := registry.GetInfo(StandardKindPlaylist)
	require.NoError(t, err)
	require.Equal(t, "Playlist", info.Name)
	require.False(t, info.IsRaw)

	// Check dummy exists
	info, err = registry.GetInfo("dummy")
	require.NoError(t, err)
	require.Equal(t, "Dummy", info.Name)
	require.True(t, info.IsRaw)
}
