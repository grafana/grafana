package git

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// Regression test for grafana/grafana#137807. Selecting cross-dashboard variables
// on a Git Sync dashboard changes only the grafana.app/useCrossDashboardVariables
// annotation. Git Sync used to drop every annotation when it wrote the file, so the
// write produced the bytes already committed and nanogit refused it with "nothing
// to commit". The dashboard is created through the files endpoint first so that
// the committed file is exactly what Grafana writes: only the annotation differs.
func TestIntegrationGitFiles_AnnotationOnlyUpdate(t *testing.T) {
	helper := sharedGitHelper(t)

	const (
		repoName  = "git-annotation-only-update"
		name      = "annotation-only-dash"
		path      = "dashboard.json"
		message   = "Use cross-dashboard variables"
		crossVars = `{"global":["gateway_base_url"]}`
	)

	_, local := helper.CreateSyncEnabledGitRepo(t, repoName, nil)
	helper.SyncAndWait(t, repoName)

	dashboard := func(t *testing.T, annotations map[string]any) []byte {
		t.Helper()
		metadata := map[string]any{"name": name}
		if annotations != nil {
			metadata["annotations"] = annotations
		}
		data, err := json.Marshal(map[string]any{
			"apiVersion": "dashboard.grafana.app/v1",
			"kind":       "Dashboard",
			"metadata":   metadata,
			"spec": map[string]any{
				"title":         "Annotation only",
				"schemaVersion": 42,
				"panels":        []any{},
			},
		})
		require.NoError(t, err)
		return data
	}

	created := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", path).
		Param("message", "Create "+name).
		Body(dashboard(t, nil)).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())
	require.NoError(t, created.Error(), "creating the dashboard file should succeed")
	helper.SyncAndWait(t, repoName)
	common.RequireRepoManagedDashboard(t, helper.DashboardsV1, name, repoName, path)

	updated := helper.AdminREST.Put().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", path).
		Param("message", message).
		Body(dashboard(t, map[string]any{utils.AnnoKeyUseCrossDashboardVariables: crossVars})).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())
	require.NoError(t, updated.Error(), "an annotation-only update should be committed, not refused as nothing to commit")
	require.Equal(t, message, common.LatestCommitSubject(t, local, "main"), "the update should be its own commit")

	raw, err := local.Git("show", "origin/main:"+path)
	require.NoError(t, err, "the committed file should be readable from the remote")
	var file map[string]any
	require.NoError(t, json.Unmarshal([]byte(raw), &file), "the committed file should be valid JSON")
	require.Equal(t, map[string]any{
		"name":        name,
		"annotations": map[string]any{utils.AnnoKeyUseCrossDashboardVariables: crossVars},
	}, file["metadata"], "the committed file should carry the selection")

	helper.SyncAndWaitIncremental(t, repoName)

	live, err := helper.DashboardsV1.Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, crossVars, live.GetAnnotations()[utils.AnnoKeyUseCrossDashboardVariables],
		"the dashboard should carry the selection after the incremental sync")
	require.Equal(t, repoName, live.GetAnnotations()[utils.AnnoKeyManagerIdentity])

	read, err := helper.AdminREST.Get().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", path).
		Do(t.Context()).
		Raw()
	require.NoError(t, err, "reading the file through the files endpoint should succeed")
	var wrapper provisioning.ResourceWrapper
	require.NoError(t, json.Unmarshal(read, &wrapper))
	require.Equal(t, crossVars,
		common.MustNestedString(wrapper.Resource.File.Object, "metadata", "annotations", utils.AnnoKeyUseCrossDashboardVariables),
		"resource.file should carry the selection")
}
