package relistkeys

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func githubConnection(name string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      name,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Keys-only ReList Connection",
			"type":  provisioning.GitHubRepositoryType,
			"github": map[string]any{
				"appID":          "12345",
				"installationID": "67890",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM)),
			},
		},
	}}
}

func createConnection(t *testing.T, helper *common.ProvisioningTestHelper, name string) string {
	t.Helper()
	created, err := helper.CreateGithubConnection(t, githubConnection(name))
	require.NoError(t, err, "failed to create connection")
	t.Cleanup(func() {
		cleanupCtx := context.WithoutCancel(t.Context())
		_ = helper.Connections.Resource.Delete(cleanupCtx, created.GetName(), metav1.DeleteOptions{})
	})
	return created.GetName()
}

// Nothing publishes watch notifications here, so a created Connection can only
// reach the controller through the periodic re-list, and with the setting on that
// re-list carries keys rather than bodies. Reaching healthy therefore proves the
// controller reconciles from identities alone, re-fetching what it needs.
func TestIntegrationProvisioningKeysReList_ConnectionReconciledFromKeys(t *testing.T) {
	helper := sharedHelper(t)
	name := createConnection(t, helper, "keys-relist-connection")

	helper.WaitForHealthyConnection(t, name)
}

// The unit tests drive the lister against a fake store, so they cannot show that
// a real server honours keys_only and fills in the fields the informer's Store
// keys on. This does, against the same client the in-process informer uses.
func TestIntegrationProvisioningKeysReList_ListerReadsRealStorage(t *testing.T) {
	helper := sharedHelper(t)
	name := createConnection(t, helper, "keys-relist-lister")

	ctx, _, err := identity.WithProvisioningIdentity(t.Context(), helper.Namespace)
	require.NoError(t, err)

	lister := informer.NewGRPCConnectionKeysLister(helper.GetEnv().ResourceClient)
	listRV, seq := lister.ListKeys(ctx)
	assert.NotZero(t, listRV, "the snapshot version callers arbitrate races with")

	keys := map[string]informer.Key{}
	for k, err := range seq {
		require.NoError(t, err, "the server must honour keys_only")
		keys[k.Name] = k
	}

	got, found := keys[name]
	require.True(t, found, "the created connection must appear in the keys list, got %v", keys)
	assert.Equal(t, helper.Namespace, got.Namespace)
	assert.NotEmpty(t, got.ResourceVersion, "the per-key version is what the Store diffs on")
}
