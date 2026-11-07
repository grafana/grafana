package repository

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/util/retry"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// managedRepository returns a local Repository carrying the given manager annotations.
func managedRepository(helper *common.ProvisioningTestHelper, name string, annotations map[string]any) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":        name,
			"namespace":   helper.Namespace,
			"annotations": annotations,
		},
		"spec": map[string]any{
			"title": "Managed repository",
			"type":  "local",
			"local": map[string]any{"path": helper.ProvisioningPath},
			"sync":  map[string]any{"enabled": false, "target": "folder", "intervalSeconds": 60},
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

// retitleRepository renames the repository through a read-modify-write, retrying on the
// conflicts the repository controller produces while it reconciles a freshly created object.
func retitleRepository(t *testing.T, helper *common.ProvisioningTestHelper, name, title string) error {
	t.Helper()
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		current, err := helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		if err := unstructured.SetNestedField(current.Object, title, "spec", "title"); err != nil {
			return err
		}
		_, err = helper.Repositories.Resource.Update(t.Context(), current, metav1.UpdateOptions{})
		return err
	})
}

// The admin UI treats a Repository owned by an external manager as read-only. The API stays
// open on purpose: the manager writes through this same endpoint with the same annotations,
// so there is no signal that separates its writes from a user's and a gate here would lock
// the owner out of its own resource.
func TestIntegrationProvisioning_ExternallyManagedRepositoryWriteAccess(t *testing.T) {
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
			name := "managed-repo-" + tc.name

			created, err := helper.Repositories.Resource.Create(t.Context(),
				managedRepository(helper, name, managerAnnotations(tc.kind, tc.allowsEdits)),
				metav1.CreateOptions{})
			require.NoError(t, err, "creating a repository with manager annotations is accepted")
			require.Equal(t, string(tc.kind), created.GetAnnotations()[utils.AnnoKeyManagerKind],
				"the manager annotation is persisted as sent")

			require.NoError(t, retitleRepository(t, helper, name, "Renamed through the API"),
				"spec update is accepted even though the UI disables Save")

			updated, err := helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
			require.NoError(t, err)
			title, _, err := unstructured.NestedString(updated.Object, "spec", "title")
			require.NoError(t, err)
			require.Equal(t, "Renamed through the API", title, "the spec change persisted")

			require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), name, metav1.DeleteOptions{}),
				"delete is accepted even though the UI hides Delete")
			helper.WaitForRepositoryDeleted(t, name)
		})
	}
}

// A Repository is never provisioned from repository files, so it cannot declare itself
// repository-managed. Admission rejects it before unified storage tries to forward the write
// to the provisioning files endpoint, which has no source path and fails opaquely.
func TestIntegrationProvisioning_RepoManagedRepositoryIsRejected(t *testing.T) {
	helper := sharedHelper(t)

	const name = "repo-managed-repo"

	_, err := helper.Repositories.Resource.Create(t.Context(),
		managedRepository(helper, name, managerAnnotations(utils.ManagerKindRepo, false)),
		metav1.CreateOptions{})
	require.Error(t, err)
	require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)
	require.Contains(t, err.Error(), utils.AnnoKeyManagerKind)

	_, err = helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "the repository was not created, got: %v", err)
}

// Adding the repository-manager annotation to an existing Repository is rejected too.
func TestIntegrationProvisioning_RepoManagedRepositoryUpdateIsRejected(t *testing.T) {
	helper := sharedHelper(t)

	const name = "becomes-repo-managed"

	_, err := helper.Repositories.Resource.Create(t.Context(),
		managedRepository(helper, name, map[string]any{}), metav1.CreateOptions{})
	require.NoError(t, err)

	err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
		current, err := helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		annotations := current.GetAnnotations()
		if annotations == nil {
			annotations = map[string]string{}
		}
		annotations[utils.AnnoKeyManagerKind] = string(utils.ManagerKindRepo)
		annotations[utils.AnnoKeyManagerIdentity] = "external-manager"
		current.SetAnnotations(annotations)
		_, err = helper.Repositories.Resource.Update(t.Context(), current, metav1.UpdateOptions{})
		return err
	})
	require.Error(t, err)
	require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)

	unchanged, err := helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err)
	require.NotContains(t, unchanged.GetAnnotations(), utils.AnnoKeyManagerKind)

	require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), name, metav1.DeleteOptions{}))
	helper.WaitForRepositoryDeleted(t, name)
}
