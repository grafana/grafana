package libraryelements

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
)

func TestConversionsCommands(t *testing.T) {
	cases := []struct {
		name           string
		input          runtime.Object
		expectedCreate *model.CreateLibraryElementCommand
		expectedPatch  *model.PatchLibraryElementCommand
	}{
		{
			name: "basic conversion",
			input: &v0alpha1.LibraryPanel{
				ObjectMeta: metav1.ObjectMeta{
					Name: "uid",
					// generation mirrors the legacy library element version and must flow
					// into the patch command's Version for optimistic concurrency.
					Generation: 3,
					Annotations: map[string]string{
						utils.AnnoKeyFolder: "aaa",
					},
				},
				Spec: v0alpha1.LibraryPanelSpec{
					Type:          "timeseries",
					PluginVersion: "1.2.3",
					Title:         "title",
					Description:   "descr",
					Options: common.Unstructured{
						Object: map[string]any{
							"hello": "options",
						},
					},
					FieldConfig: common.Unstructured{
						Object: map[string]any{
							"hello": "fieldConfig",
						},
					},
					PanelTitle: "panel title",
					GridPos: v0alpha1.GridPos{
						W: 1, H: 2, X: 3, Y: 4,
					},
					Transparent: true,
					Links: []common.Unstructured{{
						Object: map[string]any{
							"link1": "hello",
						},
					}},
					Datasource: &data.DataSourceRef{
						UID:        "uid",
						Type:       "ttt",
						APIVersion: "v0alpha1",
					},
				},
			},
			// in the legacy model blob "title" is the panel display title (spec.panelTitle),
			// while the library panel name (spec.title) maps to the command Name / SQL column
			expectedCreate: &model.CreateLibraryElementCommand{
				FolderUID: new("aaa"),
				UID:       "uid",
				Name:      "title",
				Kind:      1,
				Model:     json.RawMessage(`{"datasource":{"type":"ttt","uid":"uid","apiVersion":"v0alpha1"},"description":"descr","fieldConfig":{"hello":"fieldConfig"},"gridPos":{"w":1,"h":2,"x":3,"y":4},"links":[{"link1":"hello"}],"options":{"hello":"options"},"pluginVersion":"1.2.3","title":"panel title","transparent":true,"type":"timeseries"}`),
			},
			expectedPatch: &model.PatchLibraryElementCommand{
				FolderUID: new("aaa"),
				UID:       "uid",
				Name:      "title",
				Kind:      1,
				Version:   3,
				Model:     json.RawMessage(`{"datasource":{"type":"ttt","uid":"uid","apiVersion":"v0alpha1"},"description":"descr","fieldConfig":{"hello":"fieldConfig"},"gridPos":{"w":1,"h":2,"x":3,"y":4},"links":[{"link1":"hello"}],"options":{"hello":"options"},"pluginVersion":"1.2.3","title":"panel title","transparent":true,"type":"timeseries"}`),
			},
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			create, err := ToCreateLibraryElementCommand(tt.input)
			require.NoError(t, err)
			if diff := cmp.Diff(tt.expectedCreate, create); diff != "" {
				require.FailNowf(t, "Create mismatch (-want +got):%s", diff)
			}

			patch, err := ToPatchLibraryElementCommand(tt.input)
			require.NoError(t, err)
			if diff := cmp.Diff(tt.expectedPatch, patch); diff != "" {
				require.FailNowf(t, "Path mismatch (-want +got):%s", diff)
			}
		})
	}
}

func TestLegacyModelToLibraryPanel(t *testing.T) {
	legacyModel := json.RawMessage(`{
		"type": "timeseries",
		"title": "panel title",
		"description": "descr",
		"options": {"hello": "options"},
		"fieldConfig": {"hello": "fieldConfig"},
		"gridPos": {"w": 1, "h": 2, "x": 3, "y": 4},
		"transformations": [{"id": "reduce", "options": {}}],
		"maxDataPoints": 100,
		"libraryPanel": {"uid": "uid", "name": "my library panel"},
		"id": 4
	}`)

	spec, status, err := LegacyModelToLibraryPanel("my library panel", legacyModel)
	require.NoError(t, err)

	// the library panel name lands in spec.title, the display title in spec.panelTitle
	require.Equal(t, "my library panel", spec.Title)
	require.Equal(t, "panel title", spec.PanelTitle)
	require.Equal(t, "timeseries", spec.Type)
	require.Equal(t, "descr", spec.Description)
	require.Equal(t, v0alpha1.GridPos{W: 1, H: 2, X: 3, Y: 4}, spec.GridPos)

	// properties without a typed spec field are preserved in status.missing,
	// while spec-mapped keys are stripped from it
	require.Contains(t, status.Missing.Object, "transformations")
	require.Contains(t, status.Missing.Object, "maxDataPoints")
	require.NotContains(t, status.Missing.Object, "type")
	require.NotContains(t, status.Missing.Object, "title")
	require.NotContains(t, status.Missing.Object, "libraryPanel")
	require.NotContains(t, status.Missing.Object, "id")
}

func TestLibraryPanelModelRoundTrip(t *testing.T) {
	legacyModel := json.RawMessage(`{
		"type": "timeseries",
		"title": "panel title",
		"description": "descr",
		"options": {"hello": "options"},
		"fieldConfig": {"hello": "fieldConfig"},
		"gridPos": {"w": 1, "h": 2, "x": 3, "y": 4},
		"transparent": true,
		"transformations": [{"id": "reduce", "options": {}}],
		"maxDataPoints": 100
	}`)

	spec, status, err := LegacyModelToLibraryPanel("my library panel", legacyModel)
	require.NoError(t, err)

	rebuilt, err := LibraryPanelToLegacyModel(&v0alpha1.LibraryPanel{Spec: spec, Status: status})
	require.NoError(t, err)

	var want, got map[string]any
	require.NoError(t, json.Unmarshal(legacyModel, &want))
	require.NoError(t, json.Unmarshal(rebuilt, &got))
	if diff := cmp.Diff(want, got); diff != "" {
		require.FailNowf(t, "model round trip mismatch (-want +got):%s", diff)
	}
}
