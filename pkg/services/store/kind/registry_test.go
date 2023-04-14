package kind

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/kind/dummy"
)

func TestKindRegistry(t *testing.T) {
	registry := NewKindRegistry()
	err := registry.Register(dummy.GetEntityKindInfo("test"), dummy.GetEntitySummaryBuilder("test"))
	require.NoError(t, err)

	ids := []string{}
	for _, k := range registry.GetKinds() {
		ids = append(ids, k.ID)
	}
	require.Equal(t, []string{
		"dashboard",
		"folder",
		"frame",
		"geojson",
		"jsonobj",
		"playlist",
		"png",
		"preferences",
		"snapshot",
		"test",
	}, ids)

	// Check playlist exists
	info, err := registry.GetInfo(entity.StandardKindPlaylist)
	require.NoError(t, err)
	require.Equal(t, "Playlist", info.Name)
	require.False(t, info.IsRaw)

	// Check that we registered a test item
	info, err = registry.GetInfo("test")
	require.NoError(t, err)
	require.Equal(t, "test", info.Name)
	require.True(t, info.IsRaw)

	// Get by suffix
	info, err = registry.GetFromExtension("png")
	require.NoError(t, err)
	require.Equal(t, "PNG", info.Name)
	require.True(t, info.IsRaw)
}
