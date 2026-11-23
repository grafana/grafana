package informers

import (
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/services/apiserver/informers/informerstest"
)

func thing(namespace, name string) *metav1.PartialObjectMetadata {
	return &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name}}
}

func newThing() runtime.Object { return &metav1.PartialObjectMetadata{} }

// startSource registers a handler that collects the names it is handed, as the
// typed objects the controller asked for, and runs the source until the test ends.
func startSource(t *testing.T, source DeltaSource) (cache.ResourceEventHandlerRegistration, func() []string) {
	var mu sync.Mutex
	var got []string
	reg, err := source.AddEventHandler(cache.ResourceEventHandlerFuncs{AddFunc: func(obj any) {
		mu.Lock()
		defer mu.Unlock()
		got = append(got, obj.(*metav1.PartialObjectMetadata).GetName())
	}})
	require.NoError(t, err)

	stop := make(chan struct{})
	t.Cleanup(func() { close(stop) })
	go source.Run(stop)
	return reg, func() []string {
		mu.Lock()
		defer mu.Unlock()
		return append([]string(nil), got...)
	}
}

func TestNewDeltaSource_APIWatchDeliversTypedObjects(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		clients := informerstest.NewClients(thing("ns", "a"), thing("ns", "b"))
		source, err := NewDeltaSource(operator.InformerRequest{
			Kind:    testKind,
			Clients: clients,
			Options: operator.InformerOptions{WatchNeeds: KeyedNeeds, CacheResyncInterval: time.Minute},
		}, newThing)
		require.NoError(t, err)

		reg, got := startSource(t, source)
		require.True(t, cache.WaitForCacheSync(t.Context().Done(), reg.HasSynced))
		synctest.Wait()
		assert.ElementsMatch(t, []string{"a", "b"}, got())
	})
}

func TestNewDeltaSource_ReListRedeliversOnEachPass(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		clients := informerstest.NewClients(thing("ns", "a"))
		source, err := NewDeltaSource(operator.InformerRequest{
			Kind:     testKind,
			Clients:  clients,
			Supplier: ProvideSupplier(natsCfg(true), nil),
			Options:  operator.InformerOptions{WatchNeeds: resyncOnly, CacheResyncInterval: time.Minute},
		}, newThing)
		require.NoError(t, err)

		reg, got := startSource(t, source)
		require.True(t, cache.WaitForCacheSync(t.Context().Done(), reg.HasSynced))
		synctest.Wait()
		assert.Equal(t, []string{"a"}, got())

		time.Sleep(time.Minute)
		synctest.Wait()
		assert.Equal(t, []string{"a", "a"}, got())
		assert.Equal(t, 2, clients.Client.Lists())
	})
}

func TestNewDeltaSource_FailsWhenTheSupplierCannotBuild(t *testing.T) {
	_, err := NewDeltaSource(operator.InformerRequest{
		Kind:     testKind,
		Clients:  informerstest.NewClients(),
		Supplier: ProvideSupplier(natsCfg(true), enabledSubscriber{}),
		Options:  operator.InformerOptions{WatchNeeds: KeyedNeeds},
	}, newThing)
	assert.ErrorIs(t, err, errNotImplemented)
}
