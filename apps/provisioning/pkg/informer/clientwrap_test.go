package informer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
)

func TestWrapClient_RoutesWatchThroughWatchFunc(t *testing.T) {
	const ns = "stacks-1"
	sentinel := watch.NewFake()
	t.Cleanup(sentinel.Stop)

	var (
		gotGVR schema.GroupVersionResource
		gotNS  string
		gotGet GetFunc
		calls  int
	)
	fn := func(_ context.Context, gvr schema.GroupVersionResource, namespace string, get GetFunc, _ metav1.ListOptions) (watch.Interface, error) {
		calls++
		gotGVR, gotNS, gotGet = gvr, namespace, get
		return sentinel, nil
	}

	// Seed one object of each type so the wrapper's getter resolves to its own
	// concrete type, letting us verify the per-type wiring through Get.
	meta := metav1.ObjectMeta{Name: "x", Namespace: ns}
	client := fake.NewClientset(
		&provisioningapis.Repository{ObjectMeta: meta},
		&provisioningapis.Job{ObjectMeta: meta},
		&provisioningapis.Connection{ObjectMeta: meta},
		&provisioningapis.HistoricJob{ObjectMeta: meta},
	)
	wrapped := WrapClient(client, fn)
	prov := wrapped.ProvisioningV0alpha1()

	cases := []struct {
		name    string
		gvr     schema.GroupVersionResource
		wantObj runtime.Object
		call    func() (watch.Interface, error)
	}{
		{"repositories", provisioningapis.RepositoryResourceInfo.GroupVersionResource(), &provisioningapis.Repository{}, func() (watch.Interface, error) {
			return prov.Repositories(ns).Watch(context.Background(), metav1.ListOptions{})
		}},
		{"jobs", provisioningapis.JobResourceInfo.GroupVersionResource(), &provisioningapis.Job{}, func() (watch.Interface, error) {
			return prov.Jobs(ns).Watch(context.Background(), metav1.ListOptions{})
		}},
		{"connections", provisioningapis.ConnectionResourceInfo.GroupVersionResource(), &provisioningapis.Connection{}, func() (watch.Interface, error) {
			return prov.Connections(ns).Watch(context.Background(), metav1.ListOptions{})
		}},
		{"historicjobs", provisioningapis.HistoricJobResourceInfo.GroupVersionResource(), &provisioningapis.HistoricJob{}, func() (watch.Interface, error) {
			return prov.HistoricJobs(ns).Watch(context.Background(), metav1.ListOptions{})
		}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			calls = 0
			gotGVR, gotNS, gotGet = schema.GroupVersionResource{}, "", nil
			w, err := tc.call()
			require.NoError(t, err)
			assert.Equal(t, 1, calls, "watch func should be invoked exactly once")
			assert.Equal(t, tc.gvr, gotGVR)
			assert.Equal(t, ns, gotNS)
			require.NotNil(t, gotGet, "wrapper must pass a getter bound to its own client")
			got, err := gotGet(context.Background(), "x", metav1.GetOptions{})
			require.NoError(t, err)
			assert.IsType(t, tc.wantObj, got, "getter must be bound to the wrapper's own type")
			assert.Equal(t, sentinel, w, "the watch func's watch.Interface should be returned")
		})
	}
}

func TestWrapClient_DelegatesListToReal(t *testing.T) {
	var watchCalled bool
	fn := func(context.Context, schema.GroupVersionResource, string, GetFunc, metav1.ListOptions) (watch.Interface, error) {
		watchCalled = true
		return nil, nil
	}

	wrapped := WrapClient(fake.NewClientset(), fn)

	// List must reach the (fake) real client, not the watch func.
	list, err := wrapped.ProvisioningV0alpha1().Repositories("stacks-1").List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	require.NotNil(t, list)
	assert.Empty(t, list.Items)
	assert.False(t, watchCalled, "List must not invoke the watch func")
}

func TestWrapClient_NilWatchFuncReturnsReal(t *testing.T) {
	real := fake.NewClientset()
	assert.Equal(t, real, WrapClient(real, nil))
}
