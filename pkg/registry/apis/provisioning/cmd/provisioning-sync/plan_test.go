package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func writeDashboard(t *testing.T, dir, name, uid string) {
	t.Helper()
	full := filepath.Join(dir, name)
	require.NoError(t, os.MkdirAll(filepath.Dir(full), 0o750))
	require.NoError(t, os.WriteFile(full, []byte(`{"uid":"`+uid+`","title":"`+uid+`","panels":[],"schemaVersion":41}`), 0o600))
}

func actionsByPath(changes []planChange) map[string]repository.FileAction {
	out := make(map[string]repository.FileAction, len(changes))
	for _, c := range changes {
		out[c.Path] = c.Action
	}
	return out
}

func TestPlanFullLocalRepository(t *testing.T) {
	dir := t.TempDir()
	writeDashboard(t, dir, "root.json", "root")
	writeDashboard(t, dir, "team/nested.json", "nested")

	cfg, err := repositoryFromFlags(options{repoType: "local", path: dir, namespace: "default"})
	require.NoError(t, err)
	repo, err := buildRepository(t.Context(), cfg, "", ".")
	require.NoError(t, err)

	t.Run("against an empty instance everything is created", func(t *testing.T) {
		result, err := planFull(t.Context(), repo, &provisioning.ResourceList{})
		require.NoError(t, err)
		assert.Equal(t, map[string]repository.FileAction{
			"root.json":        repository.FileActionCreated,
			"team/nested.json": repository.FileActionCreated,
			"team/":            repository.FileActionCreated,
		}, actionsByPath(result.Changes))
		assert.Equal(t, []string{"team/"}, result.FoldersMissingMetadata)
	})

	t.Run("resources no longer in the repository are deleted", func(t *testing.T) {
		current := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{
			{Path: "gone.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "gone"},
		}}
		result, err := planFull(t.Context(), repo, current)
		require.NoError(t, err)

		var deleted *planChange
		for i := range result.Changes {
			if result.Changes[i].Path == "gone.json" {
				deleted = &result.Changes[i]
			}
		}
		require.NotNil(t, deleted)
		assert.Equal(t, repository.FileActionDeleted, deleted.Action)
		assert.Equal(t, "dashboard.grafana.app/dashboards/gone", deleted.Existing)
	})

	t.Run("incremental is rejected for an unversioned repository", func(t *testing.T) {
		_, err := planIncremental(t.Context(), repo)
		require.ErrorContains(t, err, "only support full pulls")
	})
}

func TestRunPlanPrintsJSON(t *testing.T) {
	dir := t.TempDir()
	writeDashboard(t, dir, "root.json", "root")

	var out bytes.Buffer
	stateFile := filepath.Join(t.TempDir(), "state.json")
	err := run(t.Context(), []string{"plan", "--type", "local", "--path", dir, "--state-file", stateFile, "--offline", "--json"}, &out, io.Discard)
	require.NoError(t, err)

	var result planResult
	require.NoError(t, json.Unmarshal(out.Bytes(), &result))
	assert.Equal(t, "full", result.Mode)
	assert.Equal(t, []planChange{{Action: repository.FileActionCreated, Path: "root.json"}}, result.Changes)
}
