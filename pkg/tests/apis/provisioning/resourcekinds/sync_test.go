package resourcekinds

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ResourceKinds_Sync verifies the import (pull) direction: every
// file in the repository is provisioned into Grafana on sync, the provisioned objects carry the
// manager + source-path annotations (and a folder annotation only for folder-scoped kinds), and
// deleting the repository removes all of them.
func TestIntegrationProvisioning_ResourceKinds_Sync(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	for _, rk := range resourceKinds {
		rk := rk
		t.Run(rk.name, func(t *testing.T) {
			client := rk.client(t, helper)

			repo := rk.name + "-sync-repo"
			helper.CreateLocalRepo(t, common.TestRepo{
				Name:                   repo,
				SyncTarget:             "instance",
				SkipResourceAssertions: true,
			})

			const count = 3
			var names []string
			for i := 0; i < count; i++ {
				name, title := rk.instance(i)
				names = append(names, name)
				// Folder-scoped kinds must live inside a folder to receive the folder annotation;
				// a subdirectory under the instance target creates that folder on sync.
				filePath := name + ".json"
				if rk.folderScoped {
					filePath = rk.name + "-folder/" + filePath
				}
				helper.WriteToProvisioningPath(t, filePath, common.ResourceToJSON(t, rk.newResource(t, name, title)))
				t.Cleanup(func() { _ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })
			}

			helper.SyncAndWait(t, repo, nil)

			for i, name := range names {
				_, wantTitle := rk.instance(i)
				got := common.RequireResource(t, ctx, client.Resource, name)

				title, _, _ := unstructured.NestedString(got.Object, "spec", "title")
				require.Equal(t, wantTitle, title)

				annotations := got.GetAnnotations()
				require.Equal(t, repo, annotations[utils.AnnoKeyManagerIdentity], "%s should be managed by the repo", name)
				require.NotEmpty(t, annotations[utils.AnnoKeySourcePath], "%s should record its source path", name)
				if rk.folderScoped {
					require.NotEmpty(t, annotations[utils.AnnoKeyFolder], "%s should carry a folder annotation", name)
				} else {
					require.Empty(t, annotations[utils.AnnoKeyFolder], "%s must not carry a folder annotation", name)
				}
			}

			// Deleting the repository must sweep away every resource it provisioned.
			require.NoError(t, helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{}))
			helper.WaitForRepositoryDeleted(t, ctx, repo)
			for _, name := range names {
				require.EventuallyWithT(t, func(collect *assert.CollectT) {
					_, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
					assert.True(collect, apierrors.IsNotFound(err), "%s should be removed after repo delete, got: %v", name, err)
				}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "%s should be deleted with the repository", name)
			}
		})
	}
}
