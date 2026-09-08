package relist

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

// TestIntegrationProvisioningNATSReList_ConnectionReconciledViaReList proves the
// connection controller's re-list fallback. As with the repository test,
// nothing publishes watch notifications in this package, so a created
// Connection can only be observed through the connection informer's periodic
// re-list — yet it must still be reconciled (health + Ready condition). This
// covers "connection resync" specifically; the connection informer uses the
// same resync_interval as the repository and job informers.
func TestIntegrationProvisioningNATSReList_ConnectionReconciledViaReList(t *testing.T) {
	helper := sharedHelper(t)
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM))

	const connName = "nats-relist-connection"
	conn := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      connName,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "NATS ReList Connection",
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
