package informer

import (
	"context"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8stesting "k8s.io/client-go/testing"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

func connWithRV(namespace, name string, rv int64) *provisioningapis.Connection {
	return &provisioningapis.Connection{ObjectMeta: metav1.ObjectMeta{
		Namespace: namespace, Name: name, ResourceVersion: strconv.FormatInt(rv, 10),
	}}
}

// The NATS wiring shares one floor between the connection delta source and its
// getter, the same contract as repositories: a notification's resource version
// becomes the minimum a reconcile read must reach, and the getter unblocks once
// the API serves it.
func TestNewConnectionDeltaSource_EnforcesNotificationVersion(t *testing.T) {
	// The API serves the stale version until the test flips caughtUp, standing in
	// for a read path that lags the committed write behind the notification.
	var caughtUp atomic.Bool
	client := fake.NewClientset()
	client.PrependReactor("get", "connections", func(k8stesting.Action) (bool, runtime.Object, error) {
		if caughtUp.Load() {
			return true, connWithRV(testNamespace, "c", rvFresh), nil
		}
		return true, connWithRV(testNamespace, "c", rvStale), nil
	})
	sub := newFakeSubscriber()
	source, getter := NewConnectionDeltaSource(sub, client, time.Minute)

	rec := &typeRecorder{}
	_, err := source.AddEventHandler(rec)
	require.NoError(t, err)
	stopCh := make(chan struct{})
	go source.Run(stopCh)
	t.Cleanup(func() { close(stopCh) })

	gvr := provisioningapis.ConnectionResourceInfo.GroupVersionResource()
	subject := resourcewatch.Subject(gvr, "")
	require.Eventually(t, func() bool { return sub.subscribed(subject) }, 5*time.Second, 5*time.Millisecond)

	// The notification announces a version ahead of what the API serves: the
	// reconcile read must not return the stale object.
	sub.publish(t, subject, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_MODIFIED, Group: gvr.Group, Resource: gvr.Resource,
		Namespace: testNamespace, Name: "c", ResourceVersion: rvFresh,
	})
	_, err = getter.Get(context.Background(), testNamespace, "c")
	require.ErrorIs(t, err, usinformer.ErrStaleRead)

	// Once the API catches up, the same floor is met and the read goes through.
	caughtUp.Store(true)
	got, err := getter.Get(context.Background(), testNamespace, "c")
	require.NoError(t, err)
	assert.Equal(t, strconv.FormatInt(rvFresh, 10), got.ResourceVersion)
}
