package playlist

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPlaylistSummary(t *testing.T) {
	// Do not parse invalid input
	_, _, err := GetSummaryBuilder()(context.Background(), "abc", []byte("{invalid json"))
	require.Error(t, err)

	playlist := Model{
		Interval: "30s",
		Name:     "test",
		// Items: []PlaylistItem{   :( does not work
		// 	{Type: PlaylistItemTypeDashboardByUid, Value: "D1"},
		// },
	}
	out, err := json.Marshal(playlist)
	require.NoError(t, err)
	require.NotNil(t, out)

	// Do not parse invalid input
	summary, body, err := GetSummaryBuilder()(context.Background(), "abc", out)
	require.NoError(t, err)
	require.Equal(t, "test", summary.Name)
	require.True(t, json.Valid(body))
}
