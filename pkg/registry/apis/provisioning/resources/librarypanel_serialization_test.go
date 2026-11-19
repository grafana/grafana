package resources

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestLibraryPanelToSaveBytesPreservesLegacySettings(t *testing.T) {
	for _, extension := range []string{"json", "yaml", "yml"} {
		t.Run(extension, func(t *testing.T) {
			obj := &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v0alpha1", "kind": "LibraryPanel",
				"metadata": map[string]any{"name": "panel"},
				"spec":     map[string]any{"type": "timeseries"},
				"status": map[string]any{"missing": map[string]any{
					"transformations": []any{map[string]any{"id": "reduce"}},
					"maxDataPoints":   int64(100), "timeFrom": "1h", "repeat": "host",
				}},
			}}
			original := obj.DeepCopy()
			parsed := &ParsedResource{Obj: obj, Info: &repository.FileInfo{Path: "panel." + extension}}
			body, err := parsed.ToSaveBytes()
			require.NoError(t, err)
			var saved map[string]any
			require.NoError(t, yaml.Unmarshal(body, &saved))
			require.NotContains(t, saved, "status")
			spec := saved["spec"].(map[string]any)
			require.Equal(t, "timeseries", spec["type"])
			require.Equal(t, map[string]any{
				"transformations": []any{map[string]any{"id": "reduce"}},
				"maxDataPoints":   100, "timeFrom": "1h", "repeat": "host",
			}, spec["additionalProperties"])
			require.Equal(t, original, obj, "serialization must not change the object used for the database write")
		})
	}
}

func TestToSaveBytesDoesNotRestoreClearedSettingsOrCopyOtherStatus(t *testing.T) {
	for _, kind := range []string{"LibraryPanel", "Dashboard"} {
		t.Run(kind, func(t *testing.T) {
			obj := &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v0alpha1", "kind": kind,
				"spec":   map[string]any{"type": "text", "additionalProperties": map[string]any{}},
				"status": map[string]any{"missing": map[string]any{"timeFrom": "1h"}},
			}}
			parsed := &ParsedResource{Obj: obj, Info: &repository.FileInfo{Path: "panel.json"}}
			body, err := parsed.ToSaveBytes()
			require.NoError(t, err)
			require.JSONEq(t, `{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"`+kind+`","spec":{"type":"text","additionalProperties":{}}}`, string(body))
		})
	}
}

func TestWriteLibraryPanelFileFromObjectPreservesLegacySettings(t *testing.T) {
	repo := repository.NewMockReaderWriter(t)
	repo.On("Config").Return(replaceRepoConfig())
	folders := NewFolderManager(repo, nil, NewEmptyFolderTree(), FolderKind)
	manager := NewResourcesManager(repo, folders, nil, NewMockResourceClients(t))
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "dashboard.grafana.app/v0alpha1", "kind": "LibraryPanel",
		"metadata": map[string]any{"name": "panel"},
		"spec":     map[string]any{"type": "text"},
		"status":   map[string]any{"missing": map[string]any{"timeFrom": "1h"}},
	}}
	var written []byte
	repo.On("Write", mock.Anything, "panel.json", "", mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) { written = args.Get(3).([]byte) }).Return(nil)
	file, _, err := manager.WriteResourceFileFromObject(context.Background(), obj, WriteOptions{})
	require.NoError(t, err)
	require.Equal(t, "panel.json", file)
	var saved map[string]any
	require.NoError(t, json.Unmarshal(written, &saved))
	require.NotContains(t, saved, "status")
	require.Equal(t, map[string]any{
		"type": "text", "additionalProperties": map[string]any{"timeFrom": "1h"},
	}, saved["spec"])
}

func TestToSaveBytesDoesNotPromoteOtherKindsStatus(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "dashboard.grafana.app/v0alpha1", "kind": "Dashboard",
		"spec":   map[string]any{"title": "Dashboard"},
		"status": map[string]any{"missing": map[string]any{"timeFrom": "1h"}},
	}}
	parsed := &ParsedResource{Obj: obj, Info: &repository.FileInfo{Path: "dashboard.json"}}
	body, err := parsed.ToSaveBytes()
	require.NoError(t, err)
	require.JSONEq(t, `{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Dashboard","spec":{"title":"Dashboard"}}`, string(body))
}
