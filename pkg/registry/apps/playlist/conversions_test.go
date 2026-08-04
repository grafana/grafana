package playlist

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestLegacyPlaylistItemOptionsRoundTrip(t *testing.T) {
	interval := "30s"
	queryParams := "var-host=host1&from=now-6h&to=now"
	obj := LegacyUpdateCommandToUnstructured(UpdatePlaylistCommand{
		Name:     "playlist",
		Interval: "5m",
		Items: []PlaylistItem{{
			Type:        "dashboard_by_uid",
			Value:       "dashboard",
			Interval:    &interval,
			QueryParams: &queryParams,
		}},
	})

	dto := UnstructuredToLegacyPlaylistDTO(obj)
	require.Len(t, dto.Items, 1)
	require.Equal(t, &interval, dto.Items[0].Interval)
	require.Equal(t, &queryParams, dto.Items[0].QueryParams)
}

func TestPreserveLegacyPlaylistItemOptions(t *testing.T) {
	existing := unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{
			"items": []any{
				map[string]any{"type": "dashboard_by_uid", "value": "dashboard", "interval": "30s", "queryParams": "var-host=one"},
				map[string]any{"type": "dashboard_by_uid", "value": "dashboard", "interval": "1m", "queryParams": "var-host=two"},
			},
		},
	}}
	obj := LegacyUpdateCommandToUnstructured(UpdatePlaylistCommand{
		Name:     "playlist",
		Interval: "5m",
		Items: []PlaylistItem{
			{Type: "dashboard_by_uid", Value: "dashboard"},
			{Type: "dashboard_by_uid", Value: "dashboard"},
		},
	})

	PreserveLegacyPlaylistItemOptions(&obj, &existing)

	items, found, err := unstructured.NestedSlice(obj.Object, "spec", "items")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "30s", items[0].(map[string]any)["interval"])
	require.Equal(t, "var-host=one", items[0].(map[string]any)["queryParams"])
	require.Equal(t, "1m", items[1].(map[string]any)["interval"])
	require.Equal(t, "var-host=two", items[1].(map[string]any)["queryParams"])
}

func TestPreserveLegacyPlaylistItemOptionsRespectsSuppliedValues(t *testing.T) {
	existing := unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{
			"items": []any{
				map[string]any{"type": "dashboard_by_uid", "value": "dashboard", "interval": "30s", "queryParams": "var-host=prod"},
				map[string]any{"type": "dashboard_by_uid", "value": "dashboard-to-clear", "interval": "1m", "queryParams": "var-host=staging"},
			},
		},
	}}
	interval := "10s"
	empty := ""
	obj := LegacyUpdateCommandToUnstructured(UpdatePlaylistCommand{
		Name:     "playlist",
		Interval: "5m",
		Items: []PlaylistItem{
			{Type: "dashboard_by_uid", Value: "dashboard", Interval: &interval},
			{Type: "dashboard_by_uid", Value: "dashboard-to-clear", Interval: &empty, QueryParams: &empty},
			{Type: "dashboard_by_uid", Value: "new-dashboard"},
		},
	})

	PreserveLegacyPlaylistItemOptions(&obj, &existing)

	items, found, err := unstructured.NestedSlice(obj.Object, "spec", "items")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "10s", items[0].(map[string]any)["interval"])
	require.Equal(t, "var-host=prod", items[0].(map[string]any)["queryParams"])
	require.Equal(t, "", items[1].(map[string]any)["interval"])
	require.Equal(t, "", items[1].(map[string]any)["queryParams"])
	require.NotContains(t, items[2].(map[string]any), "interval")
	require.NotContains(t, items[2].(map[string]any), "queryParams")
}
