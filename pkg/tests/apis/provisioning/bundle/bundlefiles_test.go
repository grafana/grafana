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

// newBundleFile builds an unstructured BundleFile. Content is always base64, whatever the
// file holds, so a caller passes raw bytes.
func newBundleFile(t *testing.T, namespace, name, bundle, path, ref string, data []byte) *unstructured.Unstructured {
	t.Helper()

	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": provisioning.APIVERSION,
		"kind":       "BundleFile",
		"metadata": map[string]any{
			"name":      name,
			"namespace": namespace,
			"labels": map[string]any{
				provisioning.BundleFileRepositoryLabel: "acme-repo",
				provisioning.BundleFileBundleLabel:     bundle,
			},
		},
		"spec": map[string]any{
			"repository": "acme-repo",
			"bundle":     bundle,
			"path":       path,
			"ref":        ref,
			"size":       int64(len(data)),
			"content":    base64.StdEncoding.EncodeToString(data),
		},
	}}
}

// TestIntegrationProvisioning_BundleFiles_CRUD covers that the bundlefiles resource is
// served and stores a bundle's supporting files, keyed by (bundle, path) with the ref as
// a field.
func TestIntegrationProvisioning_BundleFiles_CRUD(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := bundleFileClient(t, helper, helper.Org1.Admin)

	data := []byte("# notes\n")
	file := newBundleFile(t, helper.Namespace, "sample-aaaaaaaaaaaa", "sample",
		"bundles/sample/docs/a.md", "ref-one", data)

	created, err := client.Resource.Create(ctx, file, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "sample-aaaaaaaaaaaa", created.GetName())

	t.Run("content round-trips through base64", func(t *testing.T) {
		stored, _, err := unstructured.NestedString(created.Object, "spec", "content")
		require.NoError(t, err)

		decoded, err := base64.StdEncoding.DecodeString(stored)
		require.NoError(t, err)
		assert.Equal(t, data, decoded)
	})

	t.Run("the ref moves without the name changing", func(t *testing.T) {
		// A bundle advancing to a newer ref updates its files in place: the name covers
		// (bundle, path) only, so there is exactly one object per claimed path.
		require.NoError(t, unstructured.SetNestedField(created.Object, "ref-two", "spec", "ref"))

		updated, err := client.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.NoError(t, err)

		ref, _, err := unstructured.NestedString(updated.Object, "spec", "ref")
		require.NoError(t, err)
		assert.Equal(t, "ref-two", ref)
		assert.Equal(t, "sample-aaaaaaaaaaaa", updated.GetName())
	})

	t.Run("a file the bundle stops claiming is deleted", func(t *testing.T) {
		require.NoError(t, client.Resource.Delete(ctx, "sample-aaaaaaaaaaaa", metav1.DeleteOptions{}))

		_, err := client.Resource.Get(ctx, "sample-aaaaaaaaaaaa", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
	})
}

// TestIntegrationProvisioning_BundleFiles_ListByBundle covers the label selector that
// reconciliation and cleanup rely on to find the files belonging to one bundle.
func TestIntegrationProvisioning_BundleFiles_ListByBundle(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := bundleFileClient(t, helper, helper.Org1.Admin)

	for _, f := range []struct {
		name, bundle, path string
	}{
		{"sample-000000000001", "sample", "bundles/sample/a.md"},
		{"sample-000000000002", "sample", "bundles/sample/b.md"},
		{"other-000000000003", "other", "bundles/other/c.md"},
	} {
		_, err := client.Resource.Create(ctx,
			newBundleFile(t, helper.Namespace, f.name, f.bundle, f.path, "ref-one", []byte(f.path)),
			metav1.CreateOptions{})
		require.NoError(t, err)
	}

	t.Cleanup(func() {
		for _, name := range []string{"sample-000000000001", "sample-000000000002", "other-000000000003"} {
			_ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{})
		}
	})

	list, err := client.Resource.List(ctx, metav1.ListOptions{
		LabelSelector: provisioning.BundleFileBundleLabel + "=sample",
	})
	require.NoError(t, err)
	require.Len(t, list.Items, 2, "expected only the two files belonging to the sample bundle")

	paths := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		path, _, err := unstructured.NestedString(item.Object, "spec", "path")
		require.NoError(t, err)
		paths = append(paths, path)
	}
	assert.ElementsMatch(t, []string{"bundles/sample/a.md", "bundles/sample/b.md"}, paths)
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
		newBundleFile(t, helper.Namespace, name, "sample", "bundles/sample/logo.bin", "ref-one", data),
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
// subject to the group's authorization rather than being open: a viewer may not write
// bundle files.
func TestIntegrationProvisioning_BundleFiles_ViewerCannotWrite(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := bundleFileClient(t, helper, helper.Org1.Viewer)

	_, err := client.Resource.Create(ctx,
		newBundleFile(t, helper.Namespace, "sample-bbbbbbbbbbbb", "sample",
			"bundles/sample/a.md", "ref-one", []byte("a")),
		metav1.CreateOptions{})

	require.Error(t, err)
	assert.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
}
