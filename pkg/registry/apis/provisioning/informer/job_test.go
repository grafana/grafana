package informer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// Mirrors jobs.LabelJobClaim; duplicated to avoid an import cycle (the jobs
// package depends on this one).
const jobClaimLabel = "provisioning.grafana.app/claim"

func fullJob(namespace, name string) *provisioningapis.Job {
	return &provisioningapis.Job{ObjectMeta: metav1.ObjectMeta{
		Namespace: namespace,
		Name:      name,
		Labels:    map[string]string{jobClaimLabel: "1"},
	}}
}

func minimalJob(namespace, name string) *provisioningapis.Job {
	return &provisioningapis.Job{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name}}
}

// A newly created job must land in the snapshot immediately, so the driver woken
// by the same notification can claim it without waiting for the next re-list.
func TestJobCacheWriteThrough_MirrorsAdds(t *testing.T) {
	store := usinformer.NewStore()
	jobCacheWriteThrough(store).OnAdd(minimalJob("stacks-1", "repo-pull"), false)

	objs := store.List(context.Background())
	require.Len(t, objs, 1)
	assert.Equal(t, "repo-pull", objs[0].(*provisioningapis.Job).GetName())
}

// Live notifications carry only namespace/name, so mirroring updates would write
// a label-less stub over the full cached job and hide the claim label the claim
// path pre-filters on — turning an in-flight job back into a claim candidate that
// burns a Get from every subsequent claim's budget.
func TestJobCacheWriteThrough_UpdateDoesNotClobberFullEntry(t *testing.T) {
	store := usinformer.NewStore()
	store.Replace([]runtime.Object{fullJob("stacks-1", "repo-pull")})

	// What a live MODIFIED (e.g. the claim itself, or a progress update) delivers.
	jobCacheWriteThrough(store).OnUpdate(nil, minimalJob("stacks-1", "repo-pull"))

	objs := store.List(context.Background())
	require.Len(t, objs, 1)
	assert.NotEmpty(t, objs[0].(*provisioningapis.Job).Labels[jobClaimLabel],
		"cached job must keep its claim label so the claim path can skip it")
}

// The informer dispatches DELETED as OnUpdate (the object may still exist
// mid-finalization), so mirroring updates would resurrect completed jobs as claim
// candidates that linger until something Gets them and 404s.
func TestJobCacheWriteThrough_DeletedNotificationDoesNotResurrect(t *testing.T) {
	store := usinformer.NewStore()
	h := jobCacheWriteThrough(store)

	h.OnAdd(minimalJob("stacks-1", "repo-pull"), false)
	h.OnDelete(minimalJob("stacks-1", "repo-pull"))
	// A DELETED notification arrives at the handler as an update.
	h.OnUpdate(nil, minimalJob("stacks-1", "repo-pull"))

	assert.Empty(t, store.List(context.Background()), "a deleted job must not be re-added as a claim candidate")
}
