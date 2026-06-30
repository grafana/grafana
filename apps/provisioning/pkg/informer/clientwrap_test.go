package informer

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
)

func TestWrapClient_RoutesWatchThroughWatchFunc(t *testing.T) {
	const ns = "stacks-1"
	sentinel := watch.NewFake()
	t.Cleanup(sentinel.Stop)

	var gotGVR schema.GroupVersionResource
	var gotNS string
	var calls int
	fn := func(_ context.Context, gvr schema.GroupVersionResource, namespace string, _ metav1.ListOptions) (watch.Interface, error) {
		calls++
		gotGVR, gotNS = gvr, namespace
		return sentinel, nil
	}

	wrapped := WrapClient(fake.NewClientset(), fn)
	prov := wrapped.ProvisioningV0alpha1()

	cases := []struct {
		name string
		gvr  schema.GroupVersionResource
		call func() (watch.Interface, error)
	}{
		{"repositories", provisioningapis.RepositoryResourceInfo.GroupVersionResource(), func() (watch.Interface, error) {
			return prov.Repositories(ns).Watch(context.Background(), metav1.ListOptions{})
		}},
		{"jobs", provisioningapis.JobResourceInfo.GroupVersionResource(), func() (watch.Interface, error) {
			return prov.Jobs(ns).Watch(context.Background(), metav1.ListOptions{})
		}},
		{"connections", provisioningapis.ConnectionResourceInfo.GroupVersionResource(), func() (watch.Interface, error) {
			return prov.Connections(ns).Watch(context.Background(), metav1.ListOptions{})
		}},
		{"historicjobs", provisioningapis.HistoricJobResourceInfo.GroupVersionResource(), func() (watch.Interface, error) {
			return prov.HistoricJobs(ns).Watch(context.Background(), metav1.ListOptions{})
		}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			calls = 0
			w, err := tc.call()
			require.NoError(t, err)
			assert.Equal(t, 1, calls, "watch func should be invoked exactly once")
			assert.Equal(t, tc.gvr, gotGVR)
			assert.Equal(t, ns, gotNS)
			assert.Equal(t, sentinel, w, "the watch func's watch.Interface should be returned")
		})
	}
}

func TestWrapClient_DelegatesListToReal(t *testing.T) {
	var watchCalled bool
	fn := func(context.Context, schema.GroupVersionResource, string, metav1.ListOptions) (watch.Interface, error) {
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

func TestNewNATSInformerFactory_DropIn(t *testing.T) {
	f := NewNATSInformerFactory(fake.NewClientset(), time.Minute)
	require.NotNil(t, f)
	// The generated accessors and typed listers must still be available.
	assert.NotNil(t, f.Provisioning().V0alpha1().Repositories().Lister())
	assert.NotNil(t, f.Provisioning().V0alpha1().Jobs().Lister())
}

func TestNewInformerFactory(t *testing.T) {
	f := NewInformerFactory(fake.NewClientset(), time.Minute)
	require.NotNil(t, f)
	assert.NotNil(t, f.Provisioning().V0alpha1().Repositories().Lister())
}
