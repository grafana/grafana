package informer

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	provisioningscheme "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/scheme"
	"github.com/grafana/grafana/pkg/infra/nats"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

// Every kind's informer is built by the same generic core, so one table asserts
// the two behaviours that core encodes: a kind with live notifications delivers
// its own concrete type built from the notification's identity, while a kind with
// them disabled (nil live-object builder) never subscribes and is driven only by
// the re-list.
func TestInformers(t *testing.T) {
	tests := []struct {
		name        string
		newInformer func(nats.Subscriber, versioned.Interface, string, time.Duration, usinformer.Store) *usinformer.Informer
		gvr         schema.GroupVersionResource
		// want is the concrete type each notification must be delivered as; a nil
		// want marks a kind that must not subscribe at all.
		want interface{}
	}{
		{"repository", NewRepositoryInformer, provisioningapis.RepositoryResourceInfo.GroupVersionResource(), &provisioningapis.Repository{}},
		{"job", NewJobInformer, provisioningapis.JobResourceInfo.GroupVersionResource(), &provisioningapis.Job{}},
		{"connection", NewConnectionInformer, provisioningapis.ConnectionResourceInfo.GroupVersionResource(), &provisioningapis.Connection{}},
		{"historicjob", NewHistoricJobInformer, provisioningapis.HistoricJobResourceInfo.GroupVersionResource(), nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sub := newFakeSubscriber()
			rec := &typeRecorder{}
			inf := tt.newInformer(sub, fake.NewClientset(), testNamespace, time.Minute, usinformer.NewStore())
			_, err := inf.AddEventHandler(rec)
			require.NoError(t, err)
			stopCh := make(chan struct{})
			go inf.Run(stopCh)
			t.Cleanup(func() { close(stopCh) })

			subject := resourcewatch.Subject(tt.gvr, testNamespace)

			if tt.want == nil {
				require.Eventually(t, inf.HasSynced, 5*time.Second, 5*time.Millisecond)
				assert.False(t, sub.subscribed(subject), "%s must not subscribe to live notifications", tt.name)
				return
			}

			require.Eventually(t, func() bool { return sub.subscribed(subject) }, 5*time.Second, 5*time.Millisecond)
			sub.publish(t, subject, &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_MODIFIED, Group: tt.gvr.Group, Resource: tt.gvr.Resource,
				Namespace: testNamespace, Name: "obj-a",
			})

			require.Eventually(t, func() bool { return rec.last() != nil }, 5*time.Second, 5*time.Millisecond)
			assert.IsType(t, tt.want, rec.last(), "%s must deliver its own concrete type", tt.name)
			accessor, err := meta.Accessor(rec.last())
			require.NoError(t, err)
			assert.Equal(t, "obj-a", accessor.GetName())
			assert.Equal(t, testNamespace, accessor.GetNamespace())
		})
	}
}

// The getter-less delta sources resolve their apiserver-backed informer from the
// kind's GVR via the generated factory (ForResource). This guards that each
// kind's GVR is registered with the factory, so the shared selector never hits
// its unreachable panic.
func TestGetterlessDeltaSources_ApiserverInformerResolves(t *testing.T) {
	client := fake.NewClientset()
	tests := []struct {
		name    string
		newFunc func(nats.Subscriber, versioned.Interface, time.Duration) DeltaSource
	}{
		{"job", NewJobDeltaSource},
		{"historicjob", NewHistoricJobDeltaSource},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// A nil subscriber selects the apiserver branch (ForResource by GVR).
			assert.NotNil(t, tt.newFunc(nil, client, time.Minute))
		})
	}
}

// The dynamic list source lists by GVR and converts each item to the kind's
// concrete type, so a kind can be wired without a typed clientset accessor while
// still handing the controllers the concrete objects they key off.
func TestNewDynamicListFunc(t *testing.T) {
	info := provisioningapis.RepositoryResourceInfo
	client := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(
		provisioningscheme.Scheme,
		map[schema.GroupVersionResource]string{info.GroupVersionResource(): info.GroupVersionKind().Kind + "List"},
		&provisioningapis.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: "r1"}},
		&provisioningapis.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: "r2"}},
		&provisioningapis.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: "other", Name: "r3"}},
	)

	objs, err := NewDynamicListFunc(client, info, testNamespace)(context.Background())
	require.NoError(t, err)
	require.Len(t, objs, 2, "list must be scoped to the namespace")
	for _, obj := range objs {
		_, ok := obj.(*provisioningapis.Repository)
		assert.Truef(t, ok, "dynamic list must convert to the concrete *Repository, got %T", obj)
	}
}
