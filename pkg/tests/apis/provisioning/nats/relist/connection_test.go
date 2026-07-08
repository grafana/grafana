package relist

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
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
	ctx := t.Context()
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

	created, err := helper.CreateGithubConnection(t, ctx, conn)
	require.NoError(t, err, "failed to create connection")
	t.Cleanup(func() {
		_ = helper.Connections.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
	})

	provisioningClient, err := clientset.NewForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	connClient := provisioningClient.ProvisioningV0alpha1().Connections("default")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		updated, err := connClient.Get(ctx, created.GetName(), metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, updated.Generation, updated.Status.ObservedGeneration,
			"controller should reconcile the observed generation")
		assert.Greater(collect, updated.Status.Health.Checked, int64(0),
			"controller should set the health check timestamp")
		assert.True(collect, updated.Status.Health.Healthy, "connection should be healthy")
		readyCondition := meta.FindStatusCondition(updated.Status.Conditions, provisioning.ConditionTypeReady)
		if assert.NotNil(collect, readyCondition, "Ready condition should be set") {
			assert.Equal(collect, metav1.ConditionTrue, readyCondition.Status)
		}
	}, reListWait, reListTick, "connection should be reconciled via the re-list within %s", reListWait)
}
