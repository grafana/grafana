package connection

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/util/retry"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func managedConnection(helper *common.ProvisioningTestHelper, name string, annotations map[string]any) *unstructured.Unstructured {
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM))
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":        name,
			"namespace":   helper.Namespace,
			"annotations": annotations,
		},
		"spec": map[string]any{
			"title": "Managed connection",
			"type":  provisioning.GitHubRepositoryType,
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}
}

func managerAnnotations(kind utils.ManagerKind, allowsEdits bool) map[string]any {
	annotations := map[string]any{
		utils.AnnoKeyManagerKind:     string(kind),
		utils.AnnoKeyManagerIdentity: "external-manager",
	}
	if allowsEdits {
		annotations[utils.AnnoKeyManagerAllowsEdits] = "true"
	}
	return annotations
}

// retitleConnection renames the connection through a read-modify-write, retrying on the
// conflicts the connection controller produces while it reconciles a freshly created object.
func retitleConnection(t *testing.T, helper *common.ProvisioningTestHelper, name, title string) error {
	t.Helper()
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		current, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		if err := unstructured.SetNestedField(current.Object, title, "spec", "title"); err != nil {
			return err
		}
		_, err = helper.Connections.Resource.Update(t.Context(), current, metav1.UpdateOptions{})
		return err
	})
}

// The admin UI treats a Connection owned by an external manager as read-only. The API stays
// open on purpose: the manager writes through this same endpoint with the same annotations,
// so there is no signal that separates its writes from a user's and a gate here would lock
// the owner out of its own resource.
func TestIntegrationProvisioning_ExternallyManagedConnectionWriteAccess(t *testing.T) {
	helper := sharedHelper(t)

	for _, tc := range []struct {
		name        string
		kind        utils.ManagerKind
		allowsEdits bool
	}{
		{name: "terraform", kind: utils.ManagerKindTerraform},
		{name: "kubectl", kind: utils.ManagerKindKubectl},
		{name: "plugin", kind: utils.ManagerKindPlugin},
		{name: "terraform-allows-edits", kind: utils.ManagerKindTerraform, allowsEdits: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			name := "managed-connection-" + tc.name

			created, err := helper.CreateGithubConnection(t,
				managedConnection(helper, name, managerAnnotations(tc.kind, tc.allowsEdits)))
			require.NoError(t, err, "creating a connection with manager annotations is accepted")
			require.Equal(t, string(tc.kind), created.GetAnnotations()[utils.AnnoKeyManagerKind],
				"the manager annotation is persisted as sent")

			require.NoError(t, retitleConnection(t, helper, name, "Renamed through the API"),
				"spec update is accepted even though the UI hides Save")

			updated, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
			require.NoError(t, err)
			title, _, err := unstructured.NestedString(updated.Object, "spec", "title")
			require.NoError(t, err)
			require.Equal(t, "Renamed through the API", title, "the spec change persisted")

			require.NoError(t, helper.Connections.Resource.Delete(t.Context(), name, metav1.DeleteOptions{}),
				"delete is accepted even though the UI hides Delete")
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				_, err := helper.Connections.Resource.Get(t.Context(), name, metav1.GetOptions{})
				assert.True(collect, apierrors.IsNotFound(err), "connection should be gone, got: %v", err)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	}
}
