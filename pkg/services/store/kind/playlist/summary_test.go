package playlist

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/kinds/playlist"
)

func TestPlaylistSummary(t *testing.T) {
	builder := GetEntitySummaryBuilder()

	// Do not parse invalid input
	_, _, err := builder(context.Background(), "abc", []byte("{invalid json"))
	require.Error(t, err)

	plist := playlist.Playlist{}
	plist.Spec.Interval = "30s"
	plist.Spec.Name = "test"
	plist.Spec.Items = []playlist.SpecPlaylistItem{
		{Type: playlist.SpecPlaylistItemTypeDashboardById, Value: "D1"},
		{Type: playlist.SpecPlaylistItemTypeDashboardByTag, Value: "tagA"},
		{Type: playlist.SpecPlaylistItemTypeDashboardByUid, Value: "D3"},
	}

	out, err := json.Marshal(plist)
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
