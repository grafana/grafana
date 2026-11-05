package bundle

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func bundleClient(t *testing.T, helper *common.ProvisioningTestHelper) *apis.K8sResourceClient {
	t.Helper()

	return helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespace,
		GVR:       provisioning.BundleResourceInfo.GroupVersionResource(),
	})
}

// bundleJSON builds a Bundle manifest as it would be committed to a repository. A path
// ending in "/" is a folder and everything under it belongs to the bundle.
func bundleJSON(t *testing.T, name string, paths []string) []byte {
	t.Helper()

	spec := map[string]any{}
	if paths != nil {
		spec["paths"] = paths
	}

	data, err := json.Marshal(map[string]any{
		"apiVersion": provisioning.APIVERSION,
		"kind":       "Bundle",
		"metadata":   map[string]any{"name": name},
		"spec":       spec,
	})
	require.NoError(t, err)
	return data
}

// writeManifest POSTs a manifest to the repository's files endpoint and returns the
// error, if any. The parser runs on this path, so an unusable manifest is rejected here.
func writeManifest(t *testing.T, helper *common.ProvisioningTestHelper, repo, path string, body []byte) error {
	t.Helper()

	return helper.AdminREST.Post().
		Namespace(helper.Namespace).
		Resource("repositories").
		Name(repo).
		SubResource("files", path).
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context()).Error()
}

func newBundleRepo(t *testing.T, helper *common.ProvisioningTestHelper, name string) {
	t.Helper()

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       name,
		LocalPath:  helper.ProvisioningPath,
		SyncTarget: "instance",
		Workflows:  []string{"write"},
	})
}

// TestIntegrationProvisioning_Bundle_Accepted covers the happy path: a Bundle manifest in
// a repository becomes a Bundle resource holding the paths it declares.
func TestIntegrationProvisioning_Bundle_Accepted(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "bundle-accepted"
	newBundleRepo(t, helper, repo)

	const name = "bundle-ok"
	paths := []string{
		"bundles/sample/README.md",
		"bundles/sample/docs/",
		"shared/query.sql",
	}

	require.NoError(t, writeManifest(t, helper, repo, "bundle-ok.json", bundleJSON(t, name, paths)))

	created, err := bundleClient(t, helper).Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err, "the Bundle resource should be created")

	stored, _, err := unstructured.NestedStringSlice(created.Object, "spec", "paths")
	require.NoError(t, err)
	assert.Equal(t, paths, stored, "the declared paths survive the round trip")
}

// TestIntegrationProvisioning_Bundle_NoPaths covers that a Bundle need not declare any
// paths; an empty file set is valid.
func TestIntegrationProvisioning_Bundle_NoPaths(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "bundle-no-files"
	newBundleRepo(t, helper, repo)

	const name = "bundle-bare"
	require.NoError(t, writeManifest(t, helper, repo, "bundle-bare.json", bundleJSON(t, name, nil)))

	created, err := bundleClient(t, helper).Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, name, created.GetName())
}

// TestIntegrationProvisioning_Bundle_Rejected covers that an unusable path makes the
// Bundle invalid, rather than yielding a bundle whose file set the pipeline would
// silently ignore. Each case fails in the parser, before any write.
func TestIntegrationProvisioning_Bundle_Rejected(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "bundle-rejected"
	newBundleRepo(t, helper, repo)

	tests := []struct {
		name  string
		paths []string
		// wantMessage is a fragment of the validation error, to show the right rule
		// rejected the manifest rather than something incidental.
		wantMessage string
	}{
		{
			name:        "traversal",
			paths:       []string{"../../etc/passwd"},
			wantMessage: "traversal",
		},
		{
			name:        "traversal in a folder entry",
			paths:       []string{"bundles/sample/../../etc/"},
			wantMessage: "traversal",
		},
		{
			name:        "absolute path",
			paths:       []string{"/etc/passwd"},
			wantMessage: "relative",
		},
		{
			name:        "hidden path",
			paths:       []string{"bundles/.secret/notes.md"},
			wantMessage: "hidden",
		},
		{
			name:        "duplicate path",
			paths:       []string{"bundles/sample/a.md", "bundles/sample/a.md"},
			wantMessage: "duplicate",
		},
		{
			name:        "empty path",
			paths:       []string{"   "},
			wantMessage: "must not be empty",
		},
		{
			name:        "root",
			paths:       []string{"/"},
			wantMessage: "must not be empty",
		},
	}

	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			name := fmt.Sprintf("bundle-rejected-%d", i)

			err := writeManifest(t, helper, repo, "bundle-rejected.json", bundleJSON(t, name, tt.paths))
			require.Error(t, err, "an unusable path must be rejected")
			assert.Contains(t, err.Error(), tt.wantMessage)

			// The manifest was rejected before any write, so no resource exists.
			_, getErr := bundleClient(t, helper).Resource.Get(t.Context(), name, metav1.GetOptions{})
			require.Error(t, getErr, "a rejected manifest must not create a resource")
		})
	}
}

// TestIntegrationProvisioning_Bundle_TooManyPaths covers the declared-path cap, which
// bounds how much one bundle can pull in before any folder is expanded.
func TestIntegrationProvisioning_Bundle_TooManyPaths(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "bundle-too-many"
	newBundleRepo(t, helper, repo)

	paths := make([]string, 65) // BundleMaxEntries is 64
	for i := range paths {
		paths[i] = fmt.Sprintf("bundles/sample/f%d.md", i)
	}

	err := writeManifest(t, helper, repo, "bundle-too-many.json", bundleJSON(t, "bundle-too-many", paths))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "at most")
}
