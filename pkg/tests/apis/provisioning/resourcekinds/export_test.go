package resourcekinds

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ResourceKinds_Export verifies that a full instance export (push)
// succeeds and writes every resource of the kind to the repository with its status stripped.
// For a disabled-by-default kind enabled here, enumerating the active kinds during export
// must not deny the kind's list — a successful multi-resource export is the regression guard.
func TestIntegrationProvisioning_ResourceKinds_Export(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	for _, rk := range resourceKinds {
		rk := rk
		t.Run(rk.name, func(t *testing.T) {
			client := rk.client(t, helper)

			const count = 3
			wantTitles := map[string]bool{}
			for i := 0; i < count; i++ {
				name, title := rk.instance(i)
				_, err := client.Resource.Create(ctx, rk.newResource(t, name, title), metav1.CreateOptions{})
				require.NoError(t, err, "should create %s", name)
				wantTitles[title] = true
				t.Cleanup(func() { _ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })
			}

			repo := rk.name + "-export-repo"
			helper.CreateLocalRepo(t, common.TestRepo{
				Name:                   repo,
				SyncTarget:             "instance", // export is only supported for instance sync
				Workflows:              []string{"write"},
				SkipResourceAssertions: true,
			})

			helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
				Action: provisioning.JobActionPush,
				Push:   &provisioning.ExportJobOptions{},
			})

			files := helper.ExportedResourceFiles(t, rk.groupPrefix())
			require.Len(t, files, count, "every %s should be exported", rk.name)
			gotTitles := map[string]bool{}
			for _, f := range files {
				obj := helper.LoadYAMLOrJSONFile(f)
				require.Nil(t, obj.Object["status"], "exported file should not carry a status")
				title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
				gotTitles[title] = true
			}
			require.Equal(t, wantTitles, gotTitles, "exported titles should match the created resources")
		})
	}
}

// TestIntegrationProvisioning_ResourceKinds_SelectiveExport verifies a selective export (Push
// with an explicit Resources list) writes only the named resources and leaves the rest out,
// exercising the generalized selective-export controller for a non-dashboard kind.
func TestIntegrationProvisioning_ResourceKinds_SelectiveExport(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	for _, rk := range resourceKinds {
		rk := rk
		t.Run(rk.name, func(t *testing.T) {
			client := rk.client(t, helper)

			const count = 3
			for i := 0; i < count; i++ {
				name, title := rk.instance(i)
				_, err := client.Resource.Create(ctx, rk.newResource(t, name, title), metav1.CreateOptions{})
				require.NoError(t, err, "should create %s", name)
				t.Cleanup(func() { _ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })
			}

			repo := rk.name + "-selective-export-repo"
			helper.CreateLocalRepo(t, common.TestRepo{
				Name:                   repo,
				SyncTarget:             "instance",
				Workflows:              []string{"write"},
				SkipResourceAssertions: true,
			})

			// Export only instances 0 and 2; instance 1 must be left out.
			name0, title0 := rk.instance(0)
			name2, title2 := rk.instance(2)
			helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
				Action: provisioning.JobActionPush,
				Push: &provisioning.ExportJobOptions{
					Resources: []provisioning.ResourceRef{
						{Name: name0, Kind: rk.kind, Group: rk.group},
						{Name: name2, Kind: rk.kind, Group: rk.group},
					},
				},
			})

			files := helper.ExportedResourceFiles(t, rk.groupPrefix())
			require.Len(t, files, 2, "only the two requested %s should be exported", rk.name)
			gotTitles := map[string]bool{}
			for _, f := range files {
				obj := helper.LoadYAMLOrJSONFile(f)
				title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
				gotTitles[title] = true
			}
			require.Equal(t, map[string]bool{title0: true, title2: true}, gotTitles)
			_, title1 := rk.instance(1)
			require.NotContains(t, gotTitles, title1, "the unselected %s must not be exported", rk.name)
		})
	}
}
