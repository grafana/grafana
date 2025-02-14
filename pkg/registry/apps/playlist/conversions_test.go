package playlist

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/playlist"
)

func TestPlaylistConversion(t *testing.T) {
	src := &playlist.PlaylistDTO{
		Id:        123,
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
	dst := convertToK8sResource(src, request.GetNamespaceMapper(nil))

	require.Equal(t, "abc", src.Uid)
	require.Equal(t, "abc", dst.Name)
	require.Equal(t, src.Name, dst.Spec.Title)

	out, err := json.MarshalIndent(dst, "", "  ")
	require.NoError(t, err)
	// fmt.Printf("%s", string(out))
	require.JSONEq(t, `{
		"metadata": {
			"name": "abc",
			"namespace": "org-3",
			"uid": "f0zxjm7ApxOafsn6DLQZ4Ezp78WRUsZqSc4taOSHq1gX",
			"resourceVersion": "54321",
			"creationTimestamp": "1970-01-01T00:00:12Z",
			"labels": {
				"grafana.app/deprecatedInternalID": "123"
			},
			"annotations": {
				"grafana.app/updatedTimestamp": "1970-01-01T00:00:54Z"
			}
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
		},
		"status": {}
	}`, string(out))
}
