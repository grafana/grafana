package v0alpha1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/setting"
)

func TestPlaylistConversion(t *testing.T) {
	src := &playlist.PlaylistDTO{
		OrgID:     3,
		Uid:       "abc",         // becomes k8s name
		Name:      "MyPlaylists", // becomes title
		Interval:  "10s",
		CreatedAt: 12345,
		UpdatedAt: 54321,
		Items: []playlist.PlaylistItemDTO{
			{Type: "dashboard_by_uid", Value: "UID0"},
			{Type: "dashboard_by_tag", Value: "tagA"},
			{Type: "dashboard_by_id", Value: "123"}, // deprecated
		},
	}
	dst := convertToK8sResource(src, orgNamespaceMapper)

	require.Equal(t, "abc", src.Uid)
	require.Equal(t, "abc", dst.Name)
	require.Equal(t, src.Name, dst.Spec.Title)

	out, err := json.MarshalIndent(dst, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s", string(out))
	require.JSONEq(t, `{
		"kind": "Playlist",
		"apiVersion": "playlist.x.grafana.com/v0alpha1",
		"metadata": {
		  "name": "abc",
		  "namespace": "org-3",
		  "uid": "abc",
		  "resourceVersion": "54321",
		  "creationTimestamp": "1970-01-01T00:00:12Z"
		},
		"spec": {
		  "title": "MyPlaylists",
		  "interval": "10s",
		  "items": [
			{
			  "type": "dashboard_by_uid",
			  "value": "UID0"
			},
			{
			  "type": "dashboard_by_tag",
			  "value": "tagA"
			},
			{
			  "type": "dashboard_by_id",
			  "value": "123"
			}
		  ]
		}
	  }`, string(out))
}

func TestNamespaceMapper(t *testing.T) {
	tests := []struct {
		name     string
		cfg      string
		orgId    int64
		expected string
	}{
		{
			name:     "default namespace",
			orgId:    1,
			expected: "default",
		},
		{
			name:     "with org",
			orgId:    123,
			expected: "org-123",
		},
		{
			name:     "with stackId",
			cfg:      "abc",
			orgId:    123, // ignored
			expected: "stack-abc",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := getNamespaceMapper(&setting.Cfg{StackID: tt.cfg})
			require.Equal(t, tt.expected, mapper(tt.orgId))
		})
	}
}
