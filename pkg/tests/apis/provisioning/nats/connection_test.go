package nats

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

// TestIntegrationProvisioningNATS_ConnectionReconciledOverNATS proves the
// connection controller is driven by a live NATS notification: a created
// Connection must be reconciled (health + Ready condition) within
// liveDeliveryWait. Like the repository controller, its only event source is
// the informer, whose re-list is 10 minutes out, so a reconcile this fast can
// only be the live ADDED notification.
func TestIntegrationProvisioningNATS_ConnectionReconciledOverNATS(t *testing.T) {
	helper := sharedHelper(t)
	ctx := t.Context()
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

	created, err := helper.CreateGithubConnection(t, ctx, conn)
	require.NoError(t, err, "failed to create connection")
	t.Cleanup(func() {
		_ = helper.Connections.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
	})

	provisioningClient, err := clientset.NewForConfig(helper.Org1.Admin.NewRestConfig())
	require.NoError(t, err)
	connClient := provisioningClient.ProvisioningV0alpha1().Connections("default")

	// The controller must observe the create over NATS and reconcile the status.
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
	}, liveDeliveryWait, liveDeliveryTick, "connection should be reconciled over NATS within %s", liveDeliveryWait)
}
