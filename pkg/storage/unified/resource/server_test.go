package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob/fileblob"
	"gocloud.dev/blob/memblob"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

func TestSimpleServer(t *testing.T) {
	testUserA := &identity.StaticRequester{
		Type:           authlib.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true, // can do anything
	}
	ctx := authlib.WithAuthInfo(context.Background(), testUserA)

	bucket := memblob.OpenBucket(nil)
	if false {
		tmp, err := os.MkdirTemp("", "xxx-*")
		require.NoError(t, err)

		bucket, err = fileblob.OpenBucket(tmp, &fileblob.Options{
			CreateDir: true,
			Metadata:  fileblob.MetadataDontWrite, // skip
		})
		require.NoError(t, err)
		fmt.Printf("ROOT: %s\n\n", tmp)
	}
	store, err := NewCDKBackend(ctx, CDKBackendOptions{
		Bucket: bucket,
	})
	require.NoError(t, err)

	server, err := NewResourceServer(ResourceServerOptions{
		Backend: store,
	})
	require.NoError(t, err)

	t.Run("playlist happy CRUD paths", func(t *testing.T) {
		raw := []byte(`{
    		"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "fdgsv37qslr0ga",
				"uid": "xyz",
				"namespace": "default",
				"annotations": {
					"grafana.app/repoName": "elsewhere",
					"grafana.app/repoPath": "path/to/item",
					"grafana.app/repoTimestamp": "2024-02-02T00:00:00Z"
				}
			},
			"spec": {
				"title": "hello",
				"interval": "5m",
				"items": [
					{
						"type": "dashboard_by_uid",
						"value": "vmie2cmWz"
					}
				]
			}
		}`)

		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		// Should be empty when we start
		all, err := server.List(ctx, &resourcepb.ListRequest{Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:    key.Group,
				Resource: key.Resource,
			},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 0)

		// should return 404 if not found
		found, err := server.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		require.NotNil(t, found.Error)
		require.Equal(t, int32(http.StatusNotFound), found.Error.Code)

		created, err := server.Create(ctx, &resourcepb.CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.NoError(t, err)
		require.Nil(t, created.Error)
		require.True(t, created.ResourceVersion > 0)

		// The key does not include resource version
		found, err = server.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		require.Nil(t, found.Error)
		require.Equal(t, created.ResourceVersion, found.ResourceVersion)

		// Now update the value
		tmp := &unstructured.Unstructured{}
		err = json.Unmarshal(found.Value, tmp)
		require.NoError(t, err)

		now := time.Now().UnixMilli()
		obj, err := utils.MetaAccessor(tmp)
		require.NoError(t, err)
		obj.SetAnnotation("test", "hello")
		obj.SetUpdatedTimestampMillis(now)
		obj.SetUpdatedBy(testUserA.GetUID())
		obj.SetLabels(map[string]string{
			utils.LabelKeyGetTrash: "", // should not be allowed to save this!
		})
		raw, err = json.Marshal(tmp)
		require.NoError(t, err)
		updated, err := server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)
		require.Equal(t, int32(400), updated.Error.Code) // bad request

		// remove the invalid labels
		obj.SetLabels(nil)
		raw, err = json.Marshal(tmp)
		require.NoError(t, err)
		updated, err = server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)
		require.Nil(t, updated.Error)
		require.True(t, updated.ResourceVersion > created.ResourceVersion)

		// We should still get the latest
		found, err = server.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		require.Nil(t, found.Error)
		require.Equal(t, updated.ResourceVersion, found.ResourceVersion)

		all, err = server.List(ctx, &resourcepb.ListRequest{Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:    key.Group,
				Resource: key.Resource,
			},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 1)
		require.Equal(t, updated.ResourceVersion, all.Items[0].ResourceVersion)

		deleted, err := server.Delete(ctx, &resourcepb.DeleteRequest{Key: key, ResourceVersion: updated.ResourceVersion})
		require.NoError(t, err)
		require.True(t, deleted.ResourceVersion > updated.ResourceVersion)

		// We should get not found status when trying to read the latest value
		found, err = server.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		require.NotNil(t, found.Error)
		require.Equal(t, int32(404), found.Error.Code)

		// And the deleted value should not be in the results
		all, err = server.List(ctx, &resourcepb.ListRequest{Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:    key.Group,
				Resource: key.Resource,
			},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 0) // empty
	})

	t.Run("playlist update optimistic concurrency check", func(t *testing.T) {
		raw := []byte(`{
    	"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "fdgsv37qslr0ga",
				"namespace": "default",
				"uid": "xyz",
				"annotations": {
					"grafana.app/repoName": "elsewhere",
					"grafana.app/repoPath": "path/to/item",
					"grafana.app/repoTimestamp": "2024-02-02T00:00:00Z"
				}
			},
			"spec": {
				"title": "hello",
				"interval": "5m",
				"items": [
					{
						"type": "dashboard_by_uid",
						"value": "vmie2cmWz"
					}
				]
			}
		}`)

		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		created, err := server.Create(ctx, &resourcepb.CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.NoError(t, err)

		// Update should return an ErrOptimisticLockingFailed the second time

		_, err = server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)

		_, err = server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.ErrorIs(t, err, ErrOptimisticLockingFailed)
	})
}

func TestRunInQueue(t *testing.T) {
	const testTenantID = "test-tenant"
	t.Run("should execute successfully when queue has capacity", func(t *testing.T) {
		s, _ := newTestServerWithQueue(t, 1, 1)
		executed := make(chan bool, 1)

		runnable := func(ctx context.Context) {
			executed <- true
		}

		err := s.runInQueue(context.Background(), testTenantID, runnable)
		require.NoError(t, err)
		assert.True(t, <-executed, "runnable should have been executed")
	})

	t.Run("should time out if a task is sitting in the queue beyond the timeout", func(t *testing.T) {
		s, _ := newTestServerWithQueue(t, 1, 1)
		executed := make(chan struct{}, 1)
		runnable := func(ctx context.Context) {
			time.Sleep(1 * time.Second)
			executed <- struct{}{}
		}

		err := s.runInQueue(context.Background(), testTenantID, runnable)
		require.Error(t, err)
		assert.Equal(t, context.DeadlineExceeded, err)
		<-executed
	})

	t.Run("should return an error if queue is consistently full after retrying", func(t *testing.T) {
		s, q := newTestServerWithQueue(t, 1, 1)
		// Task 1: This will be picked up by the worker and block it.
		blocker := make(chan struct{})
		blockingRunnable := func() {
			<-blocker
		}
		err := q.Enqueue(context.Background(), testTenantID, blockingRunnable)
		require.NoError(t, err)
		err = q.Enqueue(context.Background(), testTenantID, blockingRunnable)
		require.NoError(t, err)
		defer close(blocker)

		// Task 2: This runnable should never execute because the queue is full.
		executed := make(chan struct{}, 1)
		runnable := func(ctx context.Context) {
			executed <- struct{}{}
		}

		err = s.runInQueue(context.Background(), testTenantID, runnable)
		require.Error(t, err)
		require.ErrorIs(t, err, scheduler.ErrTenantQueueFull)
	})
}

// newTestServerWithQueue creates a server with a real scheduler.Queue for testing.
// It also sets up a worker to consume items from the queue.
func newTestServerWithQueue(t *testing.T, maxSizePerTenant int, numWorkers int) (*server, *scheduler.Queue) {
	t.Helper()
	q := scheduler.NewQueue(&scheduler.QueueOptions{
		MaxSizePerTenant: maxSizePerTenant,
		Registerer:       prometheus.NewRegistry(),
		Logger:           log.NewNopLogger(),
	})
	err := services.StartAndAwaitRunning(context.Background(), q)
	require.NoError(t, err)
	t.Cleanup(func() {
		services.StopAndAwaitTerminated(context.Background(), q)
	})

	// Create a worker to consume from the queue
	worker, err := scheduler.NewScheduler(q, &scheduler.Config{
		Logger:     log.NewNopLogger(),
		NumWorkers: numWorkers,
	})
	require.NoError(t, err)
	err = services.StartAndAwaitRunning(context.Background(), worker)
	require.NoError(t, err)
	t.Cleanup(func() {
		services.StopAndAwaitTerminated(context.Background(), worker)
	})

	s := &server{
		queue: q,
		queueConfig: QueueConfig{
			Timeout:    500 * time.Millisecond,
			MaxRetries: 2,
			MinBackoff: 10 * time.Millisecond,
		},
		log: slog.Default(),
	}
	return s, q
}
