package nats

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATS_ConnectionReconciledOverNATS proves the
// connection controller is driven by a live NATS notification: a created
// Connection is reconciled to healthy (WaitForHealthyConnection) with the
// re-list pushed to 10m, so the reconcile can only be the live ADDED
// notification.
func TestIntegrationProvisioningNATS_ConnectionReconciledOverNATS(t *testing.T) {
	helper := sharedHelper(t)
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM))

	const connName = "nats-connection"
	conn := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      connName,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "NATS Test Connection",
			"type":  provisioning.GitHubRepositoryType,
			"github": map[string]any{
				"appID":          "12345",
				"installationID": "67890",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}

	created, err := helper.CreateGithubConnection(t, conn)
	require.NoError(t, err, "failed to create connection")
	t.Cleanup(func() {
		cleanupCtx := context.WithoutCancel(t.Context())
		_ = helper.Connections.Resource.Delete(cleanupCtx, created.GetName(), metav1.DeleteOptions{})
	})

	helper.WaitForHealthyConnection(t, created.GetName())
}
