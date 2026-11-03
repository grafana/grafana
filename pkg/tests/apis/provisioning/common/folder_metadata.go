package common

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func FolderMetadataFiles(t *testing.T, repoName string, folders ...string) map[string][]byte {
	t.Helper()
	files := make(map[string][]byte)
	for _, folderPath := range folders {
		for dir := safepath.Clean(folderPath); dir != ""; dir = safepath.Clean(path.Dir(dir)) {
			require.True(t, filepath.IsLocal(dir), "folder path must be relative to the repository: %s", dir)
			metadataPath := path.Join(dir, "_folder.json")
			if _, exists := files[metadataPath]; exists {
				break
			}
			folder := resources.ParseFolder(dir, repoName)
			files[metadataPath] = FolderBody(t, folder.ID, folder.Title)
		}
	}
	return files
}

func WriteFolderMetadata(t *testing.T, repoName, rootDir string, folders ...string) {
	t.Helper()
	for filePath, body := range FolderMetadataFiles(t, repoName, folders...) {
		fullPath := filepath.Join(rootDir, filepath.FromSlash(filePath))
		require.NoError(t, os.MkdirAll(filepath.Dir(fullPath), 0o750))
		// Preserve explicit fixtures, including intentionally invalid manifests.
		file, err := os.OpenFile(fullPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600) // #nosec G304 -- Test-controlled fixture root and validated relative folder paths.
		if os.IsExist(err) {
			continue
		}
		require.NoError(t, err)
		_, writeErr := file.Write(body)
		closeErr := file.Close()
		require.NoError(t, writeErr)
		require.NoError(t, closeErr)
	}
}

func HasOnlyMissingFolderMetadataWarnings(paths ...string) JobMatcher {
	return func(t *testing.T, job *unstructured.Unstructured) {
		t.Helper()
		HasNoErrors()(t, job)
		HasState(provisioning.JobStateWarning)(t, job)
		warnings := MustNestedStringSlice(job.Object, "status", "warnings")
		require.NoError(t, checkMissingFolderMetadataWarnings(warnings, paths), "job %q warnings: %v", job.GetName(), warnings)
	}
}

func checkMissingFolderMetadataWarnings(warnings, paths []string) error {
	if len(paths) == 0 || len(warnings) != len(paths) {
		return fmt.Errorf("expected one missing-metadata warning for each of %v, got %d warnings", paths, len(warnings))
	}
	expected := make(map[string]bool, len(paths))
	for _, folderPath := range paths {
		message := resources.NewMissingFolderMetadata(safepath.Clean(folderPath) + "/").Error()
		if expected[message] {
			return fmt.Errorf("duplicate expected folder path %q", folderPath)
		}
		expected[message] = true
	}
	for _, warning := range warnings {
		// Full and incremental sync can report different actions for the same folder.
		message, _, _ := strings.Cut(warning, " (file: ")
		if !expected[message] {
			return fmt.Errorf("unexpected or duplicate warning: %s", warning)
		}
		delete(expected, message)
	}
	return nil
}
