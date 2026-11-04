package resourcekinds

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ResourceKinds_PullJobSummary verifies the job results of a pull:
// status.summary carries one row per kind, counting every resource the job created, and names
// it by the kind's storage collection rather than by the API group that served each resource.
// A collection kind is the case that distinguishes the two — a data source is served by
// {plugin}.datasource.grafana.app, one group per installed plugin.
func TestIntegrationProvisioning_ResourceKinds_PullJobSummary(t *testing.T) {
	helper := sharedHelper(t)

	for _, rk := range resourceKinds {
		t.Run(rk.name, func(t *testing.T) {
			client := rk.client(t, helper)

			// Its own repository root, so the summary counts only this kind's files and
			// not those the sibling subtests left in the shared provisioning path.
			repo := rk.name + "-summary-repo"
			helper.CreateLocalRepo(t, common.TestRepo{
				Name:       repo,
				LocalPath:  filepath.Join(helper.ProvisioningPath, repo),
				SyncTarget: "folder",
			})

			const count = 2
			for i := range count {
				name, title := rk.instance(i)
				filePath := name + ".json"
				if rk.folderScoped {
					filePath = rk.name + "-folder/" + filePath
				}
				helper.WriteToProvisioningPath(t, repo+"/"+filePath, common.ResourceToJSON(t, rk.newResource(t, name, title)))
				cleanupCtx := context.WithoutCancel(t.Context())
				t.Cleanup(func() { _ = client.Resource.Delete(cleanupCtx, name, metav1.DeleteOptions{}) })
			}

			job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
				Action: provisioning.JobActionPull,
				Pull:   &provisioning.SyncJobOptions{},
			})
			// A folder-scoped kind warns on the folder row for the missing metadata file the
			// harness does not write; the kind's own row must still come back clean.
			require.NotEqual(t, string(provisioning.JobStateError),
				common.MustNestedString(job.Object, "status", "state"), "pull job should not fail")

			summary := jobSummary(t, job)
			rows := make([]provisioning.JobResourceSummary, 0, 1)
			for _, row := range summary {
				if row.Kind == rk.kind {
					rows = append(rows, row)
				}
			}
			require.Len(t, rows, 1, "%s should be summarised as a single row, got %+v", rk.kind, summary)
			require.Equal(t, rk.summaryGroup(), rows[0].Group, "%s should be summarised under its collection", rk.kind)
			require.EqualValues(t, count, rows[0].Create, "%s should count every created resource", rk.kind)
			require.Zero(t, rows[0].Error, "%s should report no errors: %v", rk.kind, rows[0].Errors)
		})
	}
}

// jobSummary decodes status.summary off a job.
func jobSummary(t *testing.T, job *unstructured.Unstructured) []provisioning.JobResourceSummary {
	t.Helper()
	raw, found, err := unstructured.NestedFieldNoCopy(job.Object, "status", "summary")
	require.NoError(t, err, "read status.summary")
	require.True(t, found, "job %s should report a summary", job.GetName())

	encoded, err := json.Marshal(raw)
	require.NoError(t, err)
	var summary []provisioning.JobResourceSummary
	require.NoError(t, json.Unmarshal(encoded, &summary))
	return summary
}
