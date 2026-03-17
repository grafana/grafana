package connection

import (
	"encoding/base64"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// labelPendingDelete mirrors the constant defined in the connection controller
// (pkg/registry/apis/provisioning/controller/labels.go) and written by the
// tenant watcher (pkg/storage/unified/resource/tenant_watcher.go).
const labelPendingDelete = "cloud.grafana.com/pending-delete"

// TestIntegrationProvisioning_ConnectionPendingDeleteLabel_SkipsReconciliation verifies
// that when a connection carries the pending-delete label the controller skips further
// reconciliation – in particular it never advances ObservedGeneration for a soft-deleted
// stack, which would otherwise happen within a few seconds of a spec change.
func TestIntegrationProvisioning_ConnectionPendingDeleteLabel_SkipsReconciliation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t)

	const connName = "pending-delete-skip-conn"
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM))

	connObj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      connName,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Pending Delete Test Connection",
			"type":  "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}

	_, err := helper.CreateGithubConnection(t, t.Context(), connObj)
	require.NoError(t, err)

	// After the initial reconciliation the controller has observed the current spec,
	// so Generation == ObservedGeneration.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Connections.Resource.Get(t.Context(), connName, metav1.GetOptions{})
		assert.NoError(collect, err)
		if err != nil {
			return
		}
		conn := common.UnstructuredToConnection(t, obj)
		assert.Equal(collect, conn.Generation, conn.Status.ObservedGeneration,
			"generation and observedGeneration should match after initial reconciliation")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"connection should be initially reconciled")

	obj, err := helper.Connections.Resource.Get(t.Context(), connName, metav1.GetOptions{})
	require.NoError(t, err)

	initialConn := common.UnstructuredToConnection(t, obj)
	require.Equal(t, initialConn.Generation, initialConn.Status.ObservedGeneration,
		"generation and observedGeneration should match after initial reconciliation")

	// Mutate the spec (changing the title increments metadata.Generation) and
	// simultaneously set the pending-delete label.  Both mutations go in one
	// Update so the controller sees the label from the very first reconcile attempt.
	obj.Object["spec"].(map[string]interface{})["title"] = "Pending Delete Test Connection (modified)"

	labels := obj.GetLabels()
	if labels == nil {
		labels = make(map[string]string)
	}
	labels[labelPendingDelete] = "true"
	obj.SetLabels(labels)

	updatedObj, err := helper.Connections.Resource.Update(t.Context(), obj, metav1.UpdateOptions{})
	require.NoError(t, err)

	newGeneration := updatedObj.GetGeneration()
	require.Greater(t, newGeneration, initialConn.Generation,
		"spec change should have incremented generation")

	// For the next 10 seconds ObservedGeneration must never advance to the new
	// generation.  Without the early-exit the controller would update it within
	// a few seconds; the 10 s window is therefore a reliable upper bound.
	require.Never(t, func() bool {
		obj, err := helper.Connections.Resource.Get(t.Context(), connName, metav1.GetOptions{})
		if err != nil {
			return false
		}
		conn := common.UnstructuredToConnection(t, obj)
		return conn.Status.ObservedGeneration >= newGeneration
	}, 10*time.Second, 200*time.Millisecond,
		"ObservedGeneration must not advance while the pending-delete label is set (reconciliation should be skipped)")

	// Sanity-check: removing the label causes the controller to process the spec
	// change normally and advance ObservedGeneration.
	obj, err = helper.Connections.Resource.Get(t.Context(), connName, metav1.GetOptions{})
	require.NoError(t, err)

	labels = obj.GetLabels()
	delete(labels, labelPendingDelete)
	obj.SetLabels(labels)

	_, err = helper.Connections.Resource.Update(t.Context(), obj, metav1.UpdateOptions{})
	require.NoError(t, err)

	helper.TriggerConnectionReconciliation(t, connName)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Connections.Resource.Get(t.Context(), connName, metav1.GetOptions{})
		assert.NoError(collect, err)
		if err != nil {
			return
		}
		conn := common.UnstructuredToConnection(t, obj)
		assert.GreaterOrEqual(collect, conn.Status.ObservedGeneration, newGeneration,
			"connection should be reconciled after label removal")
		assert.True(collect, conn.Status.Health.Healthy,
			"connection should be healthy after label removal")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"connection should reconcile successfully once the pending-delete label is removed")
}
