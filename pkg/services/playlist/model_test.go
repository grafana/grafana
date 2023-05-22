package playlist

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/kinds/playlist"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/require"
)

func TestPlaylistConversion(t *testing.T) {
	src := PlaylistDTO{
		Uid:      "abc",
		Name:     "TeamA",
		Interval: "10s",
		Items: []playlist.Item{
			{Title: util.Pointer("First"), Type: playlist.ItemTypeDashboardByUid, Value: "UID0"},
			{Title: util.Pointer("Second"), Type: playlist.ItemTypeDashboardByTag, Value: "tagA"},
			{Title: util.Pointer("Third"), Type: playlist.ItemTypeDashboardById, Value: "123"},
		},
	}

	dst := PlaylistToResource(src)

	require.Equal(t, "abc", src.Uid)
	require.Equal(t, "abc", dst.Metadata.Name)
	require.Equal(t, src.Name, dst.Spec.Name)

	out, err := json.MarshalIndent(dst, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s", string(out))
	require.JSONEq(t, `{
		"apiVersion": "v0.0-alpha",
		"kind": "Playlist",
		"metadata": {
		  "name": "abc",
		  "creationTimestamp": null
		},
		"spec": {
		  "interval": "10s",
		  "items": [
			{
			  "title": "First",
			  "type": "dashboard_by_uid",
			  "value": "UID0"
			},
			{
			  "title": "Second",
			  "type": "dashboard_by_tag",
			  "value": "tagA"
			},
			{
			  "title": "Third",
			  "type": "dashboard_by_id",
			  "value": "123"
			}
		  ],
		  "name": "TeamA",
		  "uid": ""
		}
	  }`, string(out))
}
