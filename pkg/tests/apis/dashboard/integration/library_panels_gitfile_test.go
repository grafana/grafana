package integration

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestLibraryPanelGitFileRoundTrip(t *testing.T) {
	if testing.Short() {
		t.Skip("starts a local Grafana API server")
	}
	for _, mode := range []grafanarest.DualWriterMode{grafanarest.Mode0, grafanarest.Mode1, grafanarest.Mode5} {
		t.Run(fmt.Sprintf("mode%d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous: true,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					setting.LibraryPanelResource: {DualWriterMode: mode},
				},
			})
			ctx := createTestContext(t, helper, helper.Org1)
			client := getResourceClient(t, helper, ctx.AdminUser, getLibraryElementGVR())
			var panel unstructured.Unstructured
			require.NoError(t, json.Unmarshal([]byte(`{
				"apiVersion":"dashboard.grafana.app/v0alpha1", "kind":"LibraryPanel",
				"metadata":{"name":"original-panel"},
				"spec":{"type":"timeseries","title":"Library panel","options":{},"fieldConfig":{}},
				"status":{"missing":{
					"transformations":[{"id":"reduce","options":{"reducers":["mean"]}}],
					"maxDataPoints":100,"interval":"30s","timeFrom":"1h","timeShift":"1d",
					"hideTimeOverride":false,"repeat":"host","repeatDirection":"h","maxPerRow":3
				}}
			}`), &panel))
			created, err := client.Resource.Create(t.Context(), &panel, metav1.CreateOptions{FieldValidation: "Strict"})
			require.NoError(t, err)
			parsed := &resources.ParsedResource{Obj: created, Info: &repository.FileInfo{Path: "panel.json"}}
			body, err := parsed.ToSaveBytes()
			require.NoError(t, err)
			var file unstructured.Unstructured
			require.NoError(t, json.Unmarshal(body, &file))
			require.NotContains(t, file.Object, "status")
			settings, found, err := unstructured.NestedMap(file.Object, "spec", "additionalProperties")
			require.NoError(t, err)
			require.True(t, found)
			require.Equal(t, int64(100), settings["maxDataPoints"])
			file.SetName("synced-panel")
			synced, err := client.Resource.Create(t.Context(), &file, metav1.CreateOptions{FieldValidation: "Strict"})
			require.NoError(t, err)

			// A later sync replaces the same object, without relying on status.
			file.SetResourceVersion(synced.GetResourceVersion())
			file.SetGeneration(synced.GetGeneration())
			_, err = client.Resource.Update(t.Context(), &file, metav1.UpdateOptions{FieldValidation: "Strict"})
			require.NoError(t, err)
			stored, err := client.Resource.Get(t.Context(), file.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			var typed dashboardV0.LibraryPanel
			require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(stored.Object, &typed))
			model, err := libraryelements.LibraryPanelToLegacyModel(&typed)
			require.NoError(t, err)
			var got map[string]any
			require.NoError(t, json.Unmarshal(model, &got))
			for key, want := range settings {
				actual, err := json.Marshal(got[key])
				require.NoError(t, err)
				expected, err := json.Marshal(want)
				require.NoError(t, err)
				require.JSONEq(t, string(expected), string(actual), key)
			}
		})
	}
}
