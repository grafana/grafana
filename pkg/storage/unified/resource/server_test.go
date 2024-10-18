package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob/fileblob"
	"gocloud.dev/blob/memblob"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestSimpleServer(t *testing.T) {
	testUserA := &identity.StaticRequester{
		Type:           claims.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true, // can do anything
	}
	ctx := claims.WithClaims(context.Background(), testUserA)

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

	opts := &ListOptions{
		Key: &ResourceKey{
			Group:    "playlist.grafana.app",
			Resource: "playlists",
		},
	}
	wr := &WatchRequest{
		Options: opts,
	}

	var wg sync.WaitGroup

	rws := &testWatchServer{
		context: ctx,
		wg:      &wg,
		limit:   3,
	}

	go func() {
		for rws.done == false {
			err = server.Watch(wr, rws)
			require.NoError(t, err)
		}
	}()

	// Wait for the watch to get wired above
	time.Sleep(time.Duration(1) * time.Second)

	t.Run("playlist happy CRUD paths", func(t *testing.T) {
		wg.Add(3) // 3 events expected - create, update, delete

		raw := []byte(`{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "fdgsv37qslr0ga",
				"namespace": "default",
				"annotations": {
					"grafana.app/originName": "elsewhere",
					"grafana.app/originPath": "path/to/item",
					"grafana.app/originTimestamp": "2024-02-02T00:00:00Z"
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

		key := &ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists", // can be anything :(
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		// Should be empty when we start
		all, err := server.List(ctx, &ListRequest{Options: &ListOptions{
			Key: &ResourceKey{
				Group:    key.Group,
				Resource: key.Resource,
			},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 0)

		created, err := server.Create(ctx, &CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.NoError(t, err)
		require.Nil(t, created.Error)
		require.True(t, created.ResourceVersion > 0)

		// The key does not include resource version
		found, err := server.Read(ctx, &ReadRequest{Key: key})
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
		raw, err = json.Marshal(tmp)
		require.NoError(t, err)

		updated, err := server.Update(ctx, &UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)
		require.Nil(t, updated.Error)
		require.True(t, updated.ResourceVersion > created.ResourceVersion)

		// We should still get the latest
		found, err = server.Read(ctx, &ReadRequest{Key: key})
		require.NoError(t, err)
		require.Nil(t, found.Error)
		require.Equal(t, updated.ResourceVersion, found.ResourceVersion)

		all, err = server.List(ctx, &ListRequest{Options: &ListOptions{
			Key: &ResourceKey{
				Group:    key.Group,
				Resource: key.Resource,
			},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 1)
		require.Equal(t, updated.ResourceVersion, all.Items[0].ResourceVersion)

		deleted, err := server.Delete(ctx, &DeleteRequest{Key: key, ResourceVersion: updated.ResourceVersion})
		require.NoError(t, err)
		require.True(t, deleted.ResourceVersion > updated.ResourceVersion)

		// We should get not found status when trying to read the latest value
		found, err = server.Read(ctx, &ReadRequest{Key: key})
		require.NoError(t, err)
		require.NotNil(t, found.Error)
		require.Equal(t, int32(404), found.Error.Code)

		// And the deleted value should not be in the results
		all, err = server.List(ctx, &ListRequest{Options: &ListOptions{
			Key: &ResourceKey{
				Group:    key.Group,
				Resource: key.Resource,
			},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 0) // empty

		wg.Wait()
	})

	t.Run("playlist update optimistic concurrency check", func(t *testing.T) {
		raw := []byte(`{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "fdgsv37qslr0ga",
				"namespace": "default",
				"annotations": {
					"grafana.app/originName": "elsewhere",
					"grafana.app/originPath": "path/to/item",
					"grafana.app/originTimestamp": "2024-02-02T00:00:00Z"
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

		key := &ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists", // can be anything :(
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		created, err := server.Create(ctx, &CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.NoError(t, err)

		// Update should return an ErrOptimisticLockingFailed the second time

		_, err = server.Update(ctx, &UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)

		_, err = server.Update(ctx, &UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.ErrorIs(t, err, ErrOptimisticLockingFailed)
	})
}

type testWatchServer struct {
	grpc.ServerStream
	context context.Context
	wg      *sync.WaitGroup
	done    bool
	counter int
	limit   int
}

func (f *testWatchServer) Send(we *WatchEvent) error {
	f.counter++
	f.wg.Done()
	if f.counter == f.limit {
		f.done = true
	}
	return nil
}

func (f *testWatchServer) RecvMsg(m interface{}) error {
	return nil
}

func (f *testWatchServer) SendMsg(m interface{}) error {
	return nil
}

func (f *testWatchServer) Context() context.Context {
	if f.context == nil {
		f.context = context.Background()
	}
	return f.context
}
