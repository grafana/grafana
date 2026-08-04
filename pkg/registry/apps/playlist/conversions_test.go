package playlist

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestLegacyPlaylistItemOptionsRoundTrip(t *testing.T) {
	interval := "30s"
	dashboardView := &DashboardView{QueryString: "var-host=host1&from=now-6h&to=now"}
	obj := LegacyUpdateCommandToUnstructured(UpdatePlaylistCommand{
		Name:     "playlist",
		Interval: "5m",
		Items: []PlaylistItem{{
			Type:          "dashboard_by_uid",
			Value:         "dashboard",
			Interval:      &interval,
			DashboardView: dashboardView,
		}},
	})

	dto := UnstructuredToLegacyPlaylistDTO(obj)
	require.Len(t, dto.Items, 1)
	require.Equal(t, &interval, dto.Items[0].Interval)
	require.Equal(t, dashboardView, dto.Items[0].DashboardView)
}

func TestPreserveLegacyPlaylistItemOptions(t *testing.T) {
	existing := unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{
			"items": []any{
				map[string]any{"type": "dashboard_by_uid", "value": "dashboard", "interval": "30s", "dashboardView": map[string]any{"queryString": "var-host=one"}},
				map[string]any{"type": "dashboard_by_uid", "value": "dashboard", "interval": "1m", "dashboardView": map[string]any{"queryString": "var-host=two"}},
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
	require.Equal(t, map[string]any{"queryString": "var-host=one"}, items[0].(map[string]any)["dashboardView"])
	require.Equal(t, "1m", items[1].(map[string]any)["interval"])
	require.Equal(t, map[string]any{"queryString": "var-host=two"}, items[1].(map[string]any)["dashboardView"])
}

func TestPreserveLegacyPlaylistItemOptionsRespectsSuppliedValues(t *testing.T) {
	existing := unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{
			"items": []any{
				map[string]any{"type": "dashboard_by_uid", "value": "dashboard", "interval": "30s", "dashboardView": map[string]any{"queryString": "var-host=prod"}},
				map[string]any{"type": "dashboard_by_uid", "value": "dashboard-to-clear", "interval": "1m", "dashboardView": map[string]any{"queryString": "var-host=staging"}},
			},
		},
	}}
	interval := "10s"
	empty := ""
	replacementView := &DashboardView{QueryString: "var-host=canary"}
	obj := LegacyUpdateCommandToUnstructured(UpdatePlaylistCommand{
		Name:     "playlist",
		Interval: "5m",
		Items: []PlaylistItem{
			{Type: "dashboard_by_uid", Value: "dashboard", Interval: &interval},
			{
				Type:          "dashboard_by_uid",
				Value:         "dashboard-to-clear",
				Interval:      &empty,
				DashboardView: replacementView,
			},
			{Type: "dashboard_by_uid", Value: "new-dashboard"},
		},
	})

	PreserveLegacyPlaylistItemOptions(&obj, &existing)

	items, found, err := unstructured.NestedSlice(obj.Object, "spec", "items")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "10s", items[0].(map[string]any)["interval"])
	require.Equal(t, map[string]any{"queryString": "var-host=prod"}, items[0].(map[string]any)["dashboardView"])
	require.Equal(t, "", items[1].(map[string]any)["interval"])
	require.Equal(t, map[string]any{"queryString": "var-host=canary"}, items[1].(map[string]any)["dashboardView"])
	require.NotContains(t, items[2].(map[string]any), "interval")
	require.NotContains(t, items[2].(map[string]any), "dashboardView")
}
