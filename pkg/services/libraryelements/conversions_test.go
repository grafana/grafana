package libraryelements

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/ptr"

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
			expectedCreate: &model.CreateLibraryElementCommand{
				FolderUID: ptr.To("aaa"),
				UID:       "uid",
				Name:      "title",
				Kind:      1,
				Model:     json.RawMessage(`{"type":"timeseries","pluginVersion":"1.2.3","title":"title","panelTitle":"panel title","description":"descr","options":{"hello":"options"},"fieldConfig":{"hello":"fieldConfig"},"datasource":{"type":"ttt","uid":"uid","apiVersion":"v0alpha1"},"gridPos":{"w":1,"h":2,"x":3,"y":4},"transparent":true,"links":[{"link1":"hello"}]}`),
			},
			expectedPatch: &model.PatchLibraryElementCommand{
				FolderUID: ptr.To("aaa"),
				UID:       "uid",
				Name:      "title",
				Kind:      1,
				Version:   0,
				Model:     json.RawMessage(`{"type":"timeseries","pluginVersion":"1.2.3","title":"title","panelTitle":"panel title","description":"descr","options":{"hello":"options"},"fieldConfig":{"hello":"fieldConfig"},"datasource":{"type":"ttt","uid":"uid","apiVersion":"v0alpha1"},"gridPos":{"w":1,"h":2,"x":3,"y":4},"transparent":true,"links":[{"link1":"hello"}]}`),
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
