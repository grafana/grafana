package bundle

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const testRepo = "acme-repo"

// pipelineClient returns a client that writes bundle files the way the provisioning
// pipeline does.
//
// Bundle files are refused from a user identity in admission -- they are derived from a
// repository, so a hand edit would be overwritten by the next sync and, until then,
// Grafana's copy would disagree with the repository it mirrors. A service account is not a
// user, so it stands in for the reconciler here until the reconciler itself exists.
func pipelineClient(t *testing.T, helper *common.ProvisioningTestHelper) *apis.K8sResourceClient {
	t.Helper()

	token := helper.Org1.AdminServiceAccountToken
	require.NotEmpty(t, token, "the harness should have minted an admin service account token")

	return helper.GetResourceClient(apis.ResourceClientArgs{
		ServiceAccountToken: token,
		Namespace:           helper.Namespace,
		GVR:                 provisioning.BundleFileResourceInfo.GroupVersionResource(),
	})
}

func userClient(t *testing.T, helper *common.ProvisioningTestHelper, user apis.User) *apis.K8sResourceClient {
	t.Helper()

	return helper.GetResourceClient(apis.ResourceClientArgs{
		User:      user,
		Namespace: helper.Namespace,
		GVR:       provisioning.BundleFileResourceInfo.GroupVersionResource(),
	})
}

// newBundleFile builds an unstructured BundleFile the way resources.NewBundleFile does,
// including the folder a bundle's files are placed in. There is no ref in the spec: the
// hash is the version.
func newBundleFile(t *testing.T, namespace, bundle, path string, data []byte) *unstructured.Unstructured {
	t.Helper()

	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": provisioning.APIVERSION,
		"kind":       "BundleFile",
		"metadata": map[string]any{
			"name":      resources.BundleFileName(bundle, path),
			"namespace": namespace,
			"labels": map[string]any{
				provisioning.BundleFileRepositoryLabel: testRepo,
				provisioning.BundleLabel:               bundle,
			},
		},
		"spec": map[string]any{
			"repository": testRepo,
			"bundle":     bundle,
			"path":       path,
			"hash":       "sha256:" + path,
			"size":       int64(len(data)),
			"content":    base64.StdEncoding.EncodeToString(data),
		},
	}}

	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetFolder(resources.BundleFolderID(bundle, testRepo))

	return obj
}

// ensureBundleFolder creates the folder a bundle's files are placed in.
//
// This is the ordering the reconciler has to follow: with folder support enabled on the
// kind, unified storage verifies the folder exists, so writing a file before its folder
// fails with "failed to read folder ... not found". The folder's UID is derived from the
// bundle, not chosen, so it is the same one NewBundleFile stamps on each file.
func ensureBundleFolder(t *testing.T, helper *common.ProvisioningTestHelper, bundle string) {
	t.Helper()

	folder := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
		"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
		"metadata": map[string]any{
			"name":      resources.BundleFolderID(bundle, testRepo),
			"namespace": helper.Namespace,
		},
		"spec": map[string]any{"title": bundle},
	}}

	_, err := helper.Folders.Resource.Create(context.Background(), folder, metav1.CreateOptions{})
	if err != nil && !apierrors.IsAlreadyExists(err) {
		require.NoError(t, err, "the bundle folder must exist before its files")
	}

	t.Cleanup(func() {
		_ = helper.Folders.Resource.Delete(context.Background(),
			resources.BundleFolderID(bundle, testRepo), metav1.DeleteOptions{})
	})
}

func decodeContent(t *testing.T, obj *unstructured.Unstructured) []byte {
	t.Helper()

	stored, _, err := unstructured.NestedString(obj.Object, "spec", "content")
	require.NoError(t, err)

	data, err := base64.StdEncoding.DecodeString(stored)
	require.NoError(t, err)
	return data
}

// TestIntegrationProvisioning_BundleFiles_CRUD covers that a bundle's files round-trip
// through storage: content survives encoding, new content replaces it under the same name,
// and a file the bundle stops holding is removed.
func TestIntegrationProvisioning_BundleFiles_CRUD(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := pipelineClient(t, helper)
	ensureBundleFolder(t, helper, "sample")

	const path = "bundles/sample/docs/a.md"
	name := resources.BundleFileName("sample", path)
	data := []byte("# notes\n")

	created, err := client.Resource.Create(ctx, newBundleFile(t, helper.Namespace, "sample", path, data),
		metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, name, created.GetName())
	assert.Equal(t, data, decodeContent(t, created))

	t.Run("places the file in the bundle's folder", func(t *testing.T) {
		meta, err := utils.MetaAccessor(created)
		require.NoError(t, err)
		assert.Equal(t, resources.BundleFolderID("sample", testRepo), meta.GetFolder())
	})

	t.Run("new content replaces the old under the same name", func(t *testing.T) {
		changed := []byte("# notes, revised\n")
		require.NoError(t, unstructured.SetNestedField(created.Object,
			base64.StdEncoding.EncodeToString(changed), "spec", "content"))
		require.NoError(t, unstructured.SetNestedField(created.Object, "sha256:changed", "spec", "hash"))

		updated, err := client.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.NoError(t, err)

		assert.Equal(t, name, updated.GetName())
		assert.Equal(t, changed, decodeContent(t, updated))
	})

	t.Run("a file the bundle stops holding is removed", func(t *testing.T) {
		require.NoError(t, client.Resource.Delete(ctx, name, metav1.DeleteOptions{}))

		_, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
	})
}

// TestIntegrationProvisioning_BundleFiles_BinaryContent covers that content which is not
// valid UTF-8 survives storage, which is why it is base64-encoded unconditionally rather
// than only when it has to be.
func TestIntegrationProvisioning_BundleFiles_BinaryContent(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := pipelineClient(t, helper)
	ensureBundleFolder(t, helper, "sample")

	const path = "bundles/sample/assets/logo.bin"
	data := []byte{0xff, 0xfe, 0x00, 0x01, 0x02}

	_, err := client.Resource.Create(ctx, newBundleFile(t, helper.Namespace, "sample", path, data),
		metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Resource.Delete(ctx, resources.BundleFileName("sample", path), metav1.DeleteOptions{})
	})

	fetched, err := client.Resource.Get(ctx, resources.BundleFileName("sample", path), metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, data, decodeContent(t, fetched))
}

// TestIntegrationProvisioning_BundleFiles_PerBundleCopies covers that two bundles declaring
// the same repository path each store their own file. Files are not shared, so deletion
// stays per bundle and there is nothing to reference-count.
func TestIntegrationProvisioning_BundleFiles_PerBundleCopies(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := pipelineClient(t, helper)
	ensureBundleFolder(t, helper, "one")
	ensureBundleFolder(t, helper, "two")

	const path = "shared/query.sql"
	one := resources.BundleFileName("one", path)
	two := resources.BundleFileName("two", path)
	require.NotEqual(t, one, two, "a shared path must resolve to a different file per bundle")

	for _, bundle := range []string{"one", "two"} {
		_, err := client.Resource.Create(ctx,
			newBundleFile(t, helper.Namespace, bundle, path, []byte("select 1")), metav1.CreateOptions{})
		require.NoError(t, err, "each bundle stores its own copy of %s", path)
	}
	t.Cleanup(func() {
		for _, name := range []string{one, two} {
			_ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{})
		}
	})

	// Deleting one bundle's copy leaves the other untouched.
	require.NoError(t, client.Resource.Delete(ctx, one, metav1.DeleteOptions{}))

	_, err := client.Resource.Get(ctx, two, metav1.GetOptions{})
	require.NoError(t, err, "the other bundle's copy survives")
}

// TestIntegrationProvisioning_BundleFiles_ListByBundle covers the label selector that
// reconciliation and cleanup rely on to find one bundle's stored files.
func TestIntegrationProvisioning_BundleFiles_ListByBundle(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := pipelineClient(t, helper)
	ensureBundleFolder(t, helper, "sample")
	ensureBundleFolder(t, helper, "other")

	files := []struct{ bundle, path string }{
		{"sample", "bundles/sample/a.md"},
		{"sample", "shared/query.sql"},
		{"other", "bundles/other/c.md"},
	}
	for _, f := range files {
		_, err := client.Resource.Create(ctx,
			newBundleFile(t, helper.Namespace, f.bundle, f.path, []byte(f.path)), metav1.CreateOptions{})
		require.NoError(t, err)
	}
	t.Cleanup(func() {
		for _, f := range files {
			_ = client.Resource.Delete(ctx, resources.BundleFileName(f.bundle, f.path), metav1.DeleteOptions{})
		}
	})

	list, err := client.Resource.List(ctx, metav1.ListOptions{
		LabelSelector: provisioning.BundleLabel + "=sample",
	})
	require.NoError(t, err)
	require.Len(t, list.Items, 2, "expected only the files of the sample bundle")

	paths := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		path, _, err := unstructured.NestedString(item.Object, "spec", "path")
		require.NoError(t, err)
		paths = append(paths, path)
	}
	assert.ElementsMatch(t, []string{"bundles/sample/a.md", "shared/query.sql"}, paths)
}

// TestIntegrationProvisioning_BundleFiles_NotWritableByHand covers the rule that keeps
// Grafana's copy honest: a bundle file is derived from a repository, so a person editing
// one would be overwritten by the next sync and, until then, Grafana would disagree with
// the repository it claims to mirror.
//
// This cannot be enforced in the API authorizer, because the reconciler authorizes through
// the same path and would be blocked with them. Admission can tell them apart.
func TestIntegrationProvisioning_BundleFiles_NotWritableByHand(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	file := func() *unstructured.Unstructured {
		return newBundleFile(t, helper.Namespace, "sample", "bundles/sample/a.md", []byte("# notes\n"))
	}

	t.Run("an admin cannot create one", func(t *testing.T) {
		_, err := userClient(t, helper, helper.Org1.Admin).Resource.Create(ctx, file(), metav1.CreateOptions{})

		require.Error(t, err)
		assert.True(t, apierrors.IsInvalid(err), "expected Invalid, got %v", err)
		assert.Contains(t, err.Error(), "cannot be edited directly")
	})

	t.Run("a viewer is refused earlier, by authorization", func(t *testing.T) {
		_, err := userClient(t, helper, helper.Org1.Viewer).Resource.Create(ctx, file(), metav1.CreateOptions{})

		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
	})
}
