package common

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	folder "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestFolderMetadataFiles(t *testing.T) {
	files := FolderMetadataFiles(t, "repo", "team/nested/", "team", "team/nested", "", ".", "/")
	require.Len(t, files, 2)
	require.NotContains(t, files, "_folder.json")
	for _, dir := range []string{"team", "team/nested"} {
		var manifest folder.Folder
		require.NoError(t, json.Unmarshal(files[dir+"/_folder.json"], &manifest))
		require.Equal(t, folder.GroupVersion.String(), manifest.APIVersion)
		require.Equal(t, "Folder", manifest.Kind)
		require.Equal(t, resources.ParseFolder(dir, "repo").ID, manifest.Name)
		require.Equal(t, filepath.Base(dir), manifest.Spec.Title)
	}
	require.Equal(t, files, FolderMetadataFiles(t, "repo", "team/nested"))
	require.NotEqual(t, files["team/_folder.json"], FolderMetadataFiles(t, "another-repo", "team")["team/_folder.json"])
	require.Empty(t, FolderMetadataFiles(t, "repo"))
}

func TestWriteFolderMetadata(t *testing.T) {
	root := filepath.Join(t.TempDir(), "custom-repository")
	require.NoError(t, os.MkdirAll(filepath.Join(root, "team", "invalid"), 0o750))
	existing := map[string][]byte{
		"team/_folder.json":         FolderBody(t, "custom-uid", "Custom title"),
		"team/invalid/_folder.json": []byte("invalid manifest"),
	}
	for name, body := range existing {
		require.NoError(t, os.WriteFile(filepath.Join(root, name), body, 0o600))
	}

	WriteFolderMetadata(t, "repo", root, "team/invalid", "team/new/nested", "/")
	WriteFolderMetadata(t, "repo", root, "team/new/nested")
	for name, body := range existing {
		got, err := os.ReadFile(filepath.Join(root, name)) // #nosec G304 -- Read a known fixture within t.TempDir().
		require.NoError(t, err)
		require.Equal(t, body, got)
	}
	for name, body := range FolderMetadataFiles(t, "repo", "team/new/nested") {
		if _, exists := existing[name]; exists {
			continue
		}
		got, err := os.ReadFile(filepath.Join(root, name)) // #nosec G304 -- Read a known fixture within t.TempDir().
		require.NoError(t, err)
		require.Equal(t, body, got)
	}
	require.NoFileExists(t, filepath.Join(root, "_folder.json"))
}

func TestHasOnlyMissingFolderMetadataWarnings(t *testing.T) {
	first := resources.NewMissingFolderMetadata("first/").Error()
	second := resources.NewMissingFolderMetadata("second/").Error()
	for _, tc := range []struct {
		name     string
		warnings []string
		paths    []string
		wantErr  bool
	}{
		{name: "one folder", warnings: []string{first}, paths: []string{"first"}},
		{name: "unordered with different actions", warnings: []string{
			second + " (file: second/, action: ignored)",
			first + " (file: first/, action: created)",
		}, paths: []string{"first/", "second/"}},
		{name: "extra warning", warnings: []string{first, second}, paths: []string{"first"}, wantErr: true},
		{name: "missing warning", warnings: []string{first}, paths: []string{"first", "second"}, wantErr: true},
		{name: "duplicate warning", warnings: []string{first, first}, paths: []string{"first", "second"}, wantErr: true},
		{name: "wrong folder", warnings: []string{second}, paths: []string{"first"}, wantErr: true},
		{name: "unrelated warning", warnings: []string{"resource quota exceeded"}, paths: []string{"first"}, wantErr: true},
		{name: "duplicate expected folder", warnings: []string{first, first}, paths: []string{"first", "first/"}, wantErr: true},
		{name: "empty expectation", wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := checkMissingFolderMetadataWarnings(tc.warnings, tc.paths)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			job := &unstructured.Unstructured{Object: map[string]any{}}
			require.NoError(t, unstructured.SetNestedField(job.Object, "warning", "status", "state"))
			require.NoError(t, unstructured.SetNestedStringSlice(job.Object, tc.warnings, "status", "warnings"))
			HasOnlyMissingFolderMetadataWarnings(tc.paths...)(t, job)
		})
	}
}
