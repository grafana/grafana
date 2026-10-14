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

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// bundleFileClient returns a client for the bundlefiles resource as the given user.
func bundleFileClient(t *testing.T, helper *common.ProvisioningTestHelper, user apis.User) *apis.K8sResourceClient {
	t.Helper()

	return helper.GetResourceClient(apis.ResourceClientArgs{
		User:      user,
		Namespace: helper.Namespace,
		GVR:       provisioning.BundleFileResourceInfo.GroupVersionResource(),
	})
}

// newBundleFile builds an unstructured BundleFile.
//
// There is no ref in the spec: the hash is the version. Content is always base64,
// whatever the file holds, so a caller passes raw bytes.
func newBundleFile(t *testing.T, namespace, name, repo, bundle, path string, data []byte) *unstructured.Unstructured {
	t.Helper()

	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": provisioning.APIVERSION,
		"kind":       "BundleFile",
		"metadata": map[string]any{
			"name":      name,
			"namespace": namespace,
			"labels": map[string]any{
				provisioning.BundleFileRepositoryLabel: repo,
				provisioning.BundleLabel:               bundle,
			},
		},
		"spec": map[string]any{
			"repository": repo,
			"bundle":     bundle,
			"path":       path,
			"hash":       "sha256:deadbeef",
			"size":       int64(len(data)),
			"content":    base64.StdEncoding.EncodeToString(data),
		},
	}}
}

// TestIntegrationProvisioning_BundleFiles_CRUD covers that the bundlefiles resource is
// served and stores a repository's supporting files.
func TestIntegrationProvisioning_BundleFiles_CRUD(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := bundleFileClient(t, helper, helper.Org1.Admin)

	data := []byte("# notes\n")
	const name = "sample-aaaaaaaaaaaa"
	file := newBundleFile(t, helper.Namespace, name, "acme-repo", "sample", "bundles/sample/docs/a.md", data)

	created, err := client.Resource.Create(ctx, file, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, name, created.GetName())

	t.Run("content round-trips through base64", func(t *testing.T) {
		stored, _, err := unstructured.NestedString(created.Object, "spec", "content")
		require.NoError(t, err)

		decoded, err := base64.StdEncoding.DecodeString(stored)
		require.NoError(t, err)
		assert.Equal(t, data, decoded)
	})

	t.Run("new content updates in place, keeping the name", func(t *testing.T) {
		// The name covers (bundle, path), so changed content is an update to the same
		// object rather than a new one.
		changed := []byte("# notes, revised\n")
		require.NoError(t, unstructured.SetNestedField(created.Object,
			base64.StdEncoding.EncodeToString(changed), "spec", "content"))
		require.NoError(t, unstructured.SetNestedField(created.Object,
			"sha256:cafebabe", "spec", "hash"))

		updated, err := client.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.NoError(t, err)
		assert.Equal(t, name, updated.GetName())

		hash, _, err := unstructured.NestedString(updated.Object, "spec", "hash")
		require.NoError(t, err)
		assert.Equal(t, "sha256:cafebabe", hash)
	})

	t.Run("a file the bundle no longer holds is deleted", func(t *testing.T) {
		require.NoError(t, client.Resource.Delete(ctx, name, metav1.DeleteOptions{}))

		_, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
	})
}

// TestIntegrationProvisioning_BundleFiles_PerBundleCopies covers that two bundles
// declaring the same repository path each store their own file. Files are not shared, so
// deletion stays per bundle and there is nothing to reference-count.
func TestIntegrationProvisioning_BundleFiles_PerBundleCopies(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := bundleFileClient(t, helper, helper.Org1.Admin)

	const path = "shared/query.sql"
	names := []string{"one-shared0000000001", "two-shared0000000002"}

	for i, bundle := range []string{"one", "two"} {
		_, err := client.Resource.Create(ctx,
			newBundleFile(t, helper.Namespace, names[i], "acme-repo", bundle, path, []byte("select 1")),
			metav1.CreateOptions{})
		require.NoError(t, err, "each bundle stores its own copy of %s", path)
	}

	t.Cleanup(func() {
		for _, name := range names {
			_ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{})
		}
	})

	// Deleting one bundle's copy leaves the other untouched.
	require.NoError(t, client.Resource.Delete(ctx, names[0], metav1.DeleteOptions{}))
	_, err := client.Resource.Get(ctx, names[1], metav1.GetOptions{})
	require.NoError(t, err, "the other bundle's copy survives")
}

// TestIntegrationProvisioning_BundleFiles_ListByBundle covers the label selector that
// reconciliation and cleanup rely on to find one bundle's stored files.
func TestIntegrationProvisioning_BundleFiles_ListByBundle(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := bundleFileClient(t, helper, helper.Org1.Admin)

	for _, f := range []struct {
		name, bundle, path string
	}{
		{"sample-000000000001", "sample", "bundles/sample/a.md"},
		{"sample-000000000002", "sample", "shared/query.sql"},
		{"other-0000000000003", "other", "bundles/other/c.md"},
	} {
		_, err := client.Resource.Create(ctx,
			newBundleFile(t, helper.Namespace, f.name, "acme-repo", f.bundle, f.path, []byte(f.path)),
			metav1.CreateOptions{})
		require.NoError(t, err)
	}

	t.Cleanup(func() {
		for _, name := range []string{"sample-000000000001", "sample-000000000002", "other-0000000000003"} {
			_ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{})
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

// TestIntegrationProvisioning_BundleFiles_BinaryContent covers that a file which is not
// valid UTF-8 survives storage, which is why content is base64-encoded unconditionally
// rather than only when it has to be.
func TestIntegrationProvisioning_BundleFiles_BinaryContent(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := bundleFileClient(t, helper, helper.Org1.Admin)

	data := []byte{0xff, 0xfe, 0x00, 0x01, 0x02}
	const name = "sample-ffffffffffff"

	_, err := client.Resource.Create(ctx,
		newBundleFile(t, helper.Namespace, name, "acme-repo", "sample", "bundles/sample/logo.bin", data),
		metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })

	fetched, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
	require.NoError(t, err)

	stored, _, err := unstructured.NestedString(fetched.Object, "spec", "content")
	require.NoError(t, err)
	decoded, err := base64.StdEncoding.DecodeString(stored)
	require.NoError(t, err)
	assert.Equal(t, data, decoded)
}

// TestIntegrationProvisioning_BundleFiles_ViewerCannotWrite covers that the resource is
// subject to the group's authorization rather than being open.
func TestIntegrationProvisioning_BundleFiles_ViewerCannotWrite(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := bundleFileClient(t, helper, helper.Org1.Viewer)

	_, err := client.Resource.Create(ctx,
		newBundleFile(t, helper.Namespace, "sample-bbbbbbbbbbbb", "acme-repo", "sample",
			"bundles/sample/a.md", []byte("a")),
		metav1.CreateOptions{})

	require.Error(t, err)
	assert.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
}
