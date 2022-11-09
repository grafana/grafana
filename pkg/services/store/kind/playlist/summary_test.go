package playlist

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/kinds/playlist"
	"github.com/stretchr/testify/require"
)

func TestPlaylistSummary(t *testing.T) {
	builder := GetObjectSummaryBuilder()

	// Do not parse invalid input
	_, _, err := builder(context.Background(), "abc", []byte("{invalid json"))
	require.Error(t, err)

	playlist := playlist.Playlist{
		Interval: "30s",
		Name:     "test",
		Items: &[]playlist.PlaylistPlaylistItem{
			{Type: playlist.PlaylistPlaylistItemTypeDashboardByUid, Value: "D1"},
			{Type: playlist.PlaylistPlaylistItemTypeDashboardByTag, Value: "tagA"},
			{Type: playlist.PlaylistPlaylistItemTypeDashboardByUid, Value: "D3"},
		},
	}
	out, err := json.Marshal(playlist)
	require.NoError(t, err)
	require.NotNil(t, out)

	// Do not parse invalid input
	summary, body, err := builder(context.Background(), "abc", out)
	require.NoError(t, err)
	require.Equal(t, "test", summary.Name)
	require.Equal(t, 2, len(summary.References))
	require.Equal(t, map[string]string{"tagA": ""}, summary.Labels)
	require.True(t, json.Valid(body))
}
