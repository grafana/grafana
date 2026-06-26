package acimpl

import (
	"context"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// iamObject builds an unstructured IAM resource (team or user) named by uid, carrying the
// deprecated internal ID label that getObjectID reads.
func iamObject(gvk schema.GroupVersionKind, namespace, uid string, internalID int64) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{}
	obj.SetGroupVersionKind(gvk)
	obj.SetNamespace(namespace)
	obj.SetName(uid)
	obj.SetLabels(map[string]string{utils.LabelKeyDeprecatedInternalID: strconv.FormatInt(internalID, 10)})
	return obj
}

// newCountingResolver returns a uidToIDResolver wired to a fake dynamic client (no apiserver),
// plus a per-resource "get" counter and a hook to delay each Get (used to force overlap in the
// single flight test). The configProvider is left nil — it is never reached because the dynamic
// clients are pre-populated.
func newCountingResolver(t *testing.T, getDelay time.Duration, objs ...*unstructured.Unstructured) (*uidToIDResolver, *int64) {
	t.Helper()

	teamGVK := teamGVR.GroupVersion().WithKind("Team")
	userGVK := userGVR.GroupVersion().WithKind("User")

	scheme := runtime.NewScheme()
	scheme.AddKnownTypeWithName(teamGVK, &unstructured.Unstructured{})
	scheme.AddKnownTypeWithName(teamGVR.GroupVersion().WithKind("TeamList"), &unstructured.UnstructuredList{})
	scheme.AddKnownTypeWithName(userGVK, &unstructured.Unstructured{})
	scheme.AddKnownTypeWithName(userGVR.GroupVersion().WithKind("UserList"), &unstructured.UnstructuredList{})

	runtimeObjs := make([]runtime.Object, 0, len(objs))
	for _, o := range objs {
		runtimeObjs = append(runtimeObjs, o)
	}

	fake := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
		teamGVR: "TeamList",
		userGVR: "UserList",
	}, runtimeObjs...)

	var getCount int64
	fake.PrependReactor("get", "*", func(k8stesting.Action) (bool, runtime.Object, error) {
		atomic.AddInt64(&getCount, 1)
		if getDelay > 0 {
			time.Sleep(getDelay)
		}
		// Fall through to the default tracker so the object is still served.
		return false, nil, nil
	})

	r := newUIDToIDResolver(nil)
	r.clients[teamGVR] = fake.Resource(teamGVR)
	r.clients[userGVR] = fake.Resource(userGVR)
	return r, &getCount
}

func TestUIDToIDResolver_Caching(t *testing.T) {
	ns := claims.NamespaceInfo{Value: "default", OrgID: 1}

	t.Run("repeated resolves of the same UID hit the cache after the first Get", func(t *testing.T) {
		r, getCount := newCountingResolver(t, 0, iamObject(teamGVR.GroupVersion().WithKind("Team"), ns.Value, "team-uid", 42))

		for i := 0; i < 5; i++ {
			id, err := r.GetTeamIDByUID(context.Background(), ns, "team-uid")
			require.NoError(t, err)
			require.Equal(t, int64(42), id)
		}

		require.Equal(t, int64(1), atomic.LoadInt64(getCount), "only the first resolve should reach the apiserver")
	})

	t.Run("concurrent resolves of the same UID collapse into a single Get", func(t *testing.T) {
		r, getCount := newCountingResolver(t, 50*time.Millisecond, iamObject(userGVR.GroupVersion().WithKind("User"), ns.Value, "user-uid", 7))

		const goroutines = 25
		var wg sync.WaitGroup
		wg.Add(goroutines)
		for i := 0; i < goroutines; i++ {
			go func() {
				defer wg.Done()
				id, err := r.GetUserIDByUID(context.Background(), ns, "user-uid")
				require.NoError(t, err)
				require.Equal(t, int64(7), id)
			}()
		}
		wg.Wait()

		require.Equal(t, int64(1), atomic.LoadInt64(getCount), "single flight should dedupe concurrent resolves")
	})

	t.Run("team and user UIDs and namespaces are cached independently", func(t *testing.T) {
		ns2 := claims.NamespaceInfo{Value: "stacks-2", OrgID: 2}
		r, getCount := newCountingResolver(t, 0,
			iamObject(teamGVR.GroupVersion().WithKind("Team"), ns.Value, "shared-uid", 1),
			iamObject(userGVR.GroupVersion().WithKind("User"), ns.Value, "shared-uid", 2),
			iamObject(teamGVR.GroupVersion().WithKind("Team"), ns2.Value, "shared-uid", 3),
		)

		teamID, err := r.GetTeamIDByUID(context.Background(), ns, "shared-uid")
		require.NoError(t, err)
		require.Equal(t, int64(1), teamID)

		userID, err := r.GetUserIDByUID(context.Background(), ns, "shared-uid")
		require.NoError(t, err)
		require.Equal(t, int64(2), userID)

		teamIDOtherNS, err := r.GetTeamIDByUID(context.Background(), ns2, "shared-uid")
		require.NoError(t, err)
		require.Equal(t, int64(3), teamIDOtherNS)

		// Re-resolving each should be served from cache.
		_, err = r.GetTeamIDByUID(context.Background(), ns, "shared-uid")
		require.NoError(t, err)
		_, err = r.GetUserIDByUID(context.Background(), ns, "shared-uid")
		require.NoError(t, err)
		_, err = r.GetTeamIDByUID(context.Background(), ns2, "shared-uid")
		require.NoError(t, err)

		require.Equal(t, int64(3), atomic.LoadInt64(getCount), "each distinct key resolves exactly once")
	})

	t.Run("a caller cancelling does not fail the others sharing the flight", func(t *testing.T) {
		r, getCount := newCountingResolver(t, 100*time.Millisecond, iamObject(userGVR.GroupVersion().WithKind("User"), ns.Value, "user-uid", 7))

		const survivors = 5
		var wg sync.WaitGroup

		// One caller cancels mid-flight; it must observe its own cancellation.
		cancelCtx, cancel := context.WithCancel(context.Background())
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := r.GetUserIDByUID(cancelCtx, ns, "user-uid")
			require.ErrorIs(t, err, context.Canceled)
		}()

		// The rest share the same flight and must still resolve successfully.
		wg.Add(survivors)
		for i := 0; i < survivors; i++ {
			go func() {
				defer wg.Done()
				id, err := r.GetUserIDByUID(context.Background(), ns, "user-uid")
				require.NoError(t, err)
				require.Equal(t, int64(7), id)
			}()
		}

		// Cancel well before the 100ms Get completes so the cancelled caller is still in flight.
		time.Sleep(20 * time.Millisecond)
		cancel()
		wg.Wait()

		require.Equal(t, int64(1), atomic.LoadInt64(getCount), "the shared fetch should run once despite one caller cancelling")
	})

	t.Run("failed resolves are not cached", func(t *testing.T) {
		// No objects: every Get is a not-found error, so nothing should be cached.
		r, getCount := newCountingResolver(t, 0)

		_, err := r.GetTeamIDByUID(context.Background(), ns, "missing-uid")
		require.Error(t, err)
		_, err = r.GetTeamIDByUID(context.Background(), ns, "missing-uid")
		require.Error(t, err)

		require.Equal(t, int64(2), atomic.LoadInt64(getCount), "errors must not be cached")
	})

	t.Run("a zero internal ID is not cached", func(t *testing.T) {
		// The object resolves but carries no usable internal ID (sentinel 0), so it must be
		// re-resolved every time rather than pinning 0 for the TTL.
		r, getCount := newCountingResolver(t, 0, iamObject(teamGVR.GroupVersion().WithKind("Team"), ns.Value, "team-uid", 0))

		for i := 0; i < 3; i++ {
			id, err := r.GetTeamIDByUID(context.Background(), ns, "team-uid")
			require.NoError(t, err)
			require.Equal(t, int64(0), id)
		}

		require.Equal(t, int64(3), atomic.LoadInt64(getCount), "a zero id must not be cached")
	})
}
