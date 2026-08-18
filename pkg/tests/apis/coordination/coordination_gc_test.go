package coordination

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationCoordinationGarbageCollector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// A tiny grace period lets the GC delete an expired lease within the test.
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:         false,
		DisableAnonymous:          true,
		APIServerStorageType:      options.StorageTypeUnified,
		EnableFeatureToggles:      []string{featuremgmt.FlagCoordinationLeasesApi},
		CoordinationGCGracePeriod: 2 * time.Second,
	})
	ctx := context.Background()
	client := helper.Org1.Admin.ResourceClient(t, clusterLeaseGVR)

	// The GC operator dogfoods the primitive: it leader-elects on its own
	// ClusterLease. Wait for that lease to exist with a holder before creating test
	// leases, so the create can't race the operator acquiring leadership.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		gc, err := client.Get(ctx, "coordination-gc", metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		holder, _, _ := unstructured.NestedString(gc.Object, "spec", "holderIdentity")
		assert.NotEmpty(c, holder, "GC leader lease should record a holder")
	}, 30*time.Second, 500*time.Millisecond, "GC did not acquire its leader lease")

	t.Run("collects an expired lease", func(t *testing.T) {
		past := time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)
		_, err := client.Create(ctx, clusterLease("gc-expired", "dead_1", past, 10), metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = client.Delete(ctx, "gc-expired", metav1.DeleteOptions{}) })

		require.EventuallyWithT(t, func(c *assert.CollectT) {
			got, err := client.Get(ctx, "gc-expired", metav1.GetOptions{})
			if apierrors.IsNotFound(err) {
				return // collected
			}
			if !assert.NoError(c, err) {
				return
			}
			// Nudge a fresh reconcile event in case the create briefly raced the
			// leader flag being set; the lease is still expired, so GC will delete it.
			anns := got.GetAnnotations()
			if anns == nil {
				anns = map[string]string{}
			}
			anns["test.grafana.app/nudge"] = time.Now().Format(time.RFC3339Nano)
			got.SetAnnotations(anns)
			_, _ = client.Update(ctx, got, metav1.UpdateOptions{})
			assert.Fail(c, "expired lease not yet collected")
		}, 30*time.Second, 1*time.Second, "GC did not delete the expired lease")
	})

	t.Run("leaves a fresh lease alone", func(t *testing.T) {
		now := time.Now().UTC().Format(time.RFC3339)
		_, err := client.Create(ctx, clusterLease("gc-fresh", "alive_1", now, 30), metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = client.Delete(ctx, "gc-fresh", metav1.DeleteOptions{}) })

		// Its deadline (renew + 30s + 2s grace) is well in the future, so it must
		// survive — GC only touches leases dead past the grace period.
		require.Never(t, func() bool {
			_, err := client.Get(ctx, "gc-fresh", metav1.GetOptions{})
			return apierrors.IsNotFound(err)
		}, 6*time.Second, 1*time.Second, "a fresh lease must not be collected")
	})
}
