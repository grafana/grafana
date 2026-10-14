package bundle

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// bundleManifest builds a manifest for the kind declared with the bundle capability. The
// `files` block is a sibling of spec, not part of it: which files belong to a resource is
// a provisioning concern and must not collide with the kind's own schema.
func bundleManifest(t *testing.T, name string, files map[string]any) []byte {
	t.Helper()

	obj := map[string]any{
		"apiVersion": "dashboard.grafana.app/v0alpha1",
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": name},
		"spec":       map[string]any{"title": "Bundle " + name},
	}
	if files != nil {
		obj["files"] = files
	}

	data, err := json.Marshal(obj)
	require.NoError(t, err)
	return data
}

// writeBundleManifest POSTs a manifest to the repository's files endpoint and returns the
// error, if any. The parser runs on this path, so a bad `files` block is rejected here.
func writeBundleManifest(t *testing.T, helper *common.ProvisioningTestHelper, repo, path string, body []byte) error {
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

// TestIntegrationProvisioning_Bundle_KindMustDeclareFilesField pins down a constraint the
// capability imposes on a bundle kind: the `files` block is a sibling of spec, so the
// kind's own schema has to declare it, exactly as Repository declares `secure`.
//
// Dashboard does not, so a manifest carrying a file set is rejected while decoding, before
// provisioning sees it -- the strict-validation exemption in resources/parser.go applies to
// the apiserver write, not to decoding the request body. A purpose-built bundle kind must
// therefore carry the field; declaring the capability alone is not enough.
func TestIntegrationProvisioning_Bundle_KindMustDeclareFilesField(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "bundle-undeclared-field"
	newBundleRepo(t, helper, repo)

	body := bundleManifest(t, "bundle-ok", map[string]any{
		"docs": map[string]any{
			"include": "bundles/sample/docs/**",
			"exclude": []any{"**/*.tmp"},
		},
		"query": map[string]any{"path": "shared/query.sql"},
	})

	err := writeBundleManifest(t, helper, repo, "bundle-ok.json", body)
	require.Error(t, err, "a kind that does not declare `files` cannot carry a file set")
	assert.Contains(t, err.Error(), `unknown field "files"`)
}

// TestIntegrationProvisioning_Bundle_Rejected covers that an unusable `files` block makes
// the manifest invalid, rather than yielding a bundle whose file set the pipeline would
// silently ignore. Each case fails in the parser, before any write.
func TestIntegrationProvisioning_Bundle_Rejected(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "bundle-rejected"
	newBundleRepo(t, helper, repo)

	const manifestPath = "bundle-rejected.json"

	tests := []struct {
		name  string
		files map[string]any
		// wantMessage is a fragment of the validation error, to show the right rule
		// rejected the manifest rather than something incidental.
		wantMessage string
	}{
		{
			name: "unrooted pattern",
			files: map[string]any{
				"everything": map[string]any{"include": "**/*.md"},
			},
			wantMessage: "literal path segment",
		},
		{
			name: "pattern rooted at a traversal",
			files: map[string]any{
				"escape": map[string]any{"include": "../../etc/**"},
			},
			wantMessage: "traversal",
		},
		{
			name: "part name with invalid characters",
			files: map[string]any{
				"Docs": map[string]any{"path": "bundles/rejected/a.md"},
			},
			wantMessage: "lowercase",
		},
		{
			name: "part declaring neither path nor include",
			files: map[string]any{
				"docs": map[string]any{"exclude": []any{"**/*.tmp"}},
			},
			wantMessage: "either path or include",
		},
		{
			name: "part declaring both path and include",
			files: map[string]any{
				"docs": map[string]any{
					"path":    "bundles/rejected/a.md",
					"include": "bundles/rejected/**",
				},
			},
			wantMessage: "not both",
		},
		{
			name: "manifest claiming itself",
			files: map[string]any{
				"self": map[string]any{"path": manifestPath},
			},
			wantMessage: "own manifest",
		},
	}

	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			name := fmt.Sprintf("bundle-rejected-%d", i)
			body := bundleManifest(t, name, tt.files)

			err := writeBundleManifest(t, helper, repo, manifestPath, body)
			require.Error(t, err, "an unusable files block must be rejected")
			assert.Contains(t, err.Error(), tt.wantMessage)

			// The manifest was rejected before any write, so no resource exists.
			_, getErr := helper.DashboardsV0.Resource.Get(t.Context(), name, metav1.GetOptions{})
			require.Error(t, getErr, "a rejected manifest must not create a resource")
		})
	}
}

// TestIntegrationProvisioning_Bundle_NoFilesBlock covers that the capability does not
// require a file set: a bundle kind with no `files` block is an ordinary resource.
func TestIntegrationProvisioning_Bundle_NoFilesBlock(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "bundle-no-files"
	newBundleRepo(t, helper, repo)

	const name = "bundle-bare"
	require.NoError(t, writeBundleManifest(t, helper, repo,
		"bundle-bare.json", bundleManifest(t, name, nil)))

	created, err := helper.DashboardsV0.Resource.Get(t.Context(), name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, name, created.GetName())
}
