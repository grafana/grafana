package informer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
)

func conn(namespace, name string) *provisioningapis.Connection {
	return &provisioningapis.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name}}
}

// Get returns a copy of the cached object: reconcile mutations on the result
// must not corrupt the informer cache that later reconciles read.
func TestNewCachedConnectionGetter_GetReturnsCopy(t *testing.T) {
	indexer := cache.NewIndexer(cache.MetaNamespaceKeyFunc, cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc})
	require.NoError(t, indexer.Add(conn(testNamespace, "a")))
	getter := NewCachedConnectionGetter(listers.NewConnectionLister(indexer))

	got, err := getter.Get(context.Background(), testNamespace, "a")
	require.NoError(t, err)
	got.Spec.Description = "mutated"

	again, err := getter.Get(context.Background(), testNamespace, "a")
	require.NoError(t, err)
	assert.Empty(t, again.Spec.Description, "mutating the returned object must not corrupt the cache")
}
