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

// newBundleFile builds an unstructured BundleFile. There is no ref in the spec: the hash
// is the version. Content is always base64, whatever the file holds.
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

// TestIntegrationProvisioning_BundleFiles_Served covers that the resource is registered
// and storage-backed, and that the label selector reconciliation and cleanup depend on is
// wired.
//
// It asserts over an empty collection on purpose: bundle files are written only by the
// provisioning pipeline, so there is no identity in this harness that may create one.
// Coverage of their contents lives in the unit tests for now, and returns here with the
// reconciler that writes them.
func TestIntegrationProvisioning_BundleFiles_Served(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	client := bundleFileClient(t, helper, helper.Org1.Admin)

	list, err := client.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "the bundlefiles resource should be served")
	assert.Empty(t, list.Items)

	byBundle, err := client.Resource.List(ctx, metav1.ListOptions{
		LabelSelector: provisioning.BundleLabel + "=sample",
	})
	require.NoError(t, err, "listing by the bundle label should be accepted")
	assert.Empty(t, byBundle.Items)
}

// TestIntegrationProvisioning_BundleFiles_NotWritableByHand covers the rule that keeps
// Grafana's copy honest: a bundle file is derived from a repository, so a person editing
// one would be overwritten by the next sync and, until then, Grafana would disagree with
// the repository it claims to mirror.
//
// This cannot be enforced in the API authorizer, because the reconciler authorizes
// through the same path and would be blocked with them. Admission can tell them apart.
func TestIntegrationProvisioning_BundleFiles_NotWritableByHand(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	file := func() *unstructured.Unstructured {
		return newBundleFile(t, helper.Namespace, "sample-aaaaaaaaaaaa", "acme-repo", "sample",
			"bundles/sample/a.md", []byte("# notes\n"))
	}

	t.Run("an admin cannot create one", func(t *testing.T) {
		_, err := bundleFileClient(t, helper, helper.Org1.Admin).
			Resource.Create(ctx, file(), metav1.CreateOptions{})

		require.Error(t, err)
		assert.True(t, apierrors.IsInvalid(err), "expected Invalid, got %v", err)
		assert.Contains(t, err.Error(), "cannot be edited directly")
	})

	t.Run("a viewer is refused earlier, by authorization", func(t *testing.T) {
		_, err := bundleFileClient(t, helper, helper.Org1.Viewer).
			Resource.Create(ctx, file(), metav1.CreateOptions{})

		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
	})
}
