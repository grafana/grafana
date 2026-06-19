package controller

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
)

// recordingQueue records AddAfter calls and no-ops everything else. handleDelete
// only ever calls AddAfter, so the embedded nil interface is never dereferenced.
type recordingQueue struct {
	workqueue.TypedRateLimitingInterface[*connectionQueueItem]
	addedAfter []*connectionQueueItem
}

func (q *recordingQueue) AddAfter(item *connectionQueueItem, _ time.Duration) {
	q.addedAfter = append(q.addedAfter, item)
}

func newRepoListerWith(t *testing.T, repos ...*provisioning.Repository) listers.RepositoryLister {
	t.Helper()
	indexer := cache.NewIndexer(
		cache.MetaNamespaceKeyFunc,
		cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc},
	)
	for _, r := range repos {
		require.NoError(t, indexer.Add(r))
	}
	return listers.NewRepositoryLister(indexer)
}

func repoForConnection(name, namespace, connName string) *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec: provisioning.RepositorySpec{
			Connection: &provisioning.ConnectionInfo{Name: connName},
		},
	}
}

func TestConnectionController_handleDelete(t *testing.T) {
	const (
		namespace = "default"
		connName  = "test-conn"
	)
	deleting := &metav1.Time{Time: time.Unix(1, 0)}

	deletingConn := func(finalizers ...string) *provisioning.Connection {
		return &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:              connName,
				Namespace:         namespace,
				DeletionTimestamp: deleting,
				Finalizers:        finalizers,
			},
		}
	}

	t.Run("no finalizer: returns without patching", func(t *testing.T) {
		patched := false
		cc := &ConnectionController{
			repoLister: newRepoListerWith(t),
			client: &mockProvisioningV0alpha1Interface{
				connectionsFunc: func(string) client.ConnectionInterface {
					return mockConnectionInterface{patchFunc: func(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*provisioning.Connection, error) {
						patched = true
						return nil, nil
					}}
				},
			},
			logger: logging.DefaultLogger,
		}

		require.NoError(t, cc.handleDelete(context.Background(), deletingConn(), &connectionQueueItem{}))
		assert.False(t, patched, "should not patch when finalizer is absent")
	})

	t.Run("referencing repository present: requeues, does not remove finalizer", func(t *testing.T) {
		patched := false
		q := &recordingQueue{}
		cc := &ConnectionController{
			repoLister: newRepoListerWith(t, repoForConnection("repo-1", namespace, connName)),
			client: &mockProvisioningV0alpha1Interface{
				connectionsFunc: func(string) client.ConnectionInterface {
					return mockConnectionInterface{patchFunc: func(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*provisioning.Connection, error) {
						patched = true
						return nil, nil
					}}
				},
			},
			queue:  q,
			logger: logging.DefaultLogger,
		}

		item := &connectionQueueItem{key: namespace + "/" + connName}
		require.NoError(t, cc.handleDelete(context.Background(), deletingConn(connection.ReferencedByRepositoriesFinalizer), item))
		assert.False(t, patched, "must not remove finalizer while a repository still references the connection")
		require.Len(t, q.addedAfter, 1, "should requeue to re-check later")
		assert.Same(t, item, q.addedAfter[0])
	})

	t.Run("repository referencing a different connection is ignored: removes finalizer", func(t *testing.T) {
		var gotPatch []byte
		cc := &ConnectionController{
			repoLister: newRepoListerWith(t, repoForConnection("repo-other", namespace, "another-conn")),
			client: &mockProvisioningV0alpha1Interface{
				connectionsFunc: func(string) client.ConnectionInterface {
					return mockConnectionInterface{patchFunc: func(_ context.Context, _ string, _ types.PatchType, data []byte, _ metav1.PatchOptions, _ ...string) (*provisioning.Connection, error) {
						gotPatch = data
						return &provisioning.Connection{}, nil
					}}
				},
			},
			logger: logging.DefaultLogger,
		}

		require.NoError(t, cc.handleDelete(context.Background(), deletingConn(connection.ReferencedByRepositoriesFinalizer), &connectionQueueItem{}))
		require.NotNil(t, gotPatch, "should patch to remove the finalizer when no repository references the connection")
		assert.True(t, strings.Contains(string(gotPatch), "/metadata/finalizers"))
		assert.True(t, strings.Contains(string(gotPatch), "remove"))
	})

	t.Run("no referencing repositories: removes finalizer", func(t *testing.T) {
		var gotPatch []byte
		cc := &ConnectionController{
			repoLister: newRepoListerWith(t),
			client: &mockProvisioningV0alpha1Interface{
				connectionsFunc: func(string) client.ConnectionInterface {
					return mockConnectionInterface{patchFunc: func(_ context.Context, _ string, _ types.PatchType, data []byte, _ metav1.PatchOptions, _ ...string) (*provisioning.Connection, error) {
						gotPatch = data
						return &provisioning.Connection{}, nil
					}}
				},
			},
			logger: logging.DefaultLogger,
		}

		require.NoError(t, cc.handleDelete(context.Background(), deletingConn(connection.ReferencedByRepositoriesFinalizer), &connectionQueueItem{}))
		require.NotNil(t, gotPatch)
	})
}

func TestConnectionController_reconcileFinalizer(t *testing.T) {
	const (
		namespace = "default"
		connName  = "test-conn"
	)
	conn := func(finalizers ...string) *provisioning.Connection {
		return &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: connName, Namespace: namespace, Finalizers: finalizers},
		}
	}

	newController := func(gotPatch *[]byte, repos ...*provisioning.Repository) *ConnectionController {
		return &ConnectionController{
			repoLister: newRepoListerWith(t, repos...),
			client: &mockProvisioningV0alpha1Interface{
				connectionsFunc: func(string) client.ConnectionInterface {
					return mockConnectionInterface{patchFunc: func(_ context.Context, _ string, _ types.PatchType, data []byte, _ metav1.PatchOptions, _ ...string) (*provisioning.Connection, error) {
						*gotPatch = data
						return &provisioning.Connection{}, nil
					}}
				},
			},
			logger: logging.DefaultLogger,
		}
	}

	t.Run("adds finalizer when a repository references the connection", func(t *testing.T) {
		var gotPatch []byte
		cc := newController(&gotPatch, repoForConnection("repo-1", namespace, connName))

		changed, err := cc.reconcileFinalizer(context.Background(), conn())
		require.NoError(t, err)
		assert.True(t, changed)
		require.NotNil(t, gotPatch)
		assert.Contains(t, string(gotPatch), connection.ReferencedByRepositoriesFinalizer)
	})

	t.Run("no-op when referenced and finalizer already present", func(t *testing.T) {
		var gotPatch []byte
		cc := newController(&gotPatch, repoForConnection("repo-1", namespace, connName))

		changed, err := cc.reconcileFinalizer(context.Background(), conn(connection.ReferencedByRepositoriesFinalizer))
		require.NoError(t, err)
		assert.False(t, changed)
		assert.Nil(t, gotPatch, "should not patch when already in desired state")
	})

	t.Run("removes finalizer when no repository references the connection", func(t *testing.T) {
		var gotPatch []byte
		cc := newController(&gotPatch) // no repos

		changed, err := cc.reconcileFinalizer(context.Background(), conn(connection.ReferencedByRepositoriesFinalizer))
		require.NoError(t, err)
		assert.True(t, changed)
		require.NotNil(t, gotPatch)
		assert.Contains(t, string(gotPatch), `"path":"/metadata/finalizers","value":[]`)
	})

	t.Run("no-op when unreferenced and finalizer absent", func(t *testing.T) {
		var gotPatch []byte
		cc := newController(&gotPatch, repoForConnection("repo-other", namespace, "another-conn"))

		changed, err := cc.reconcileFinalizer(context.Background(), conn())
		require.NoError(t, err)
		assert.False(t, changed)
		assert.Nil(t, gotPatch)
	})
}
