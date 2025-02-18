package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gocloud.dev/blob/fileblob"
	"gocloud.dev/blob/memblob"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
	ctx := claims.WithAuthInfo(context.Background(), testUserA)

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

		key := &ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
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
		obj.SetLabels(map[string]string{
			utils.LabelKeyGetTrash: "", // should not be allowed to save this!
		})
		raw, err = json.Marshal(tmp)
		require.NoError(t, err)
		updated, err := server.Update(ctx, &UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)
		require.Equal(t, int32(400), updated.Error.Code) // bad request

		// remove the invalid labels
		obj.SetLabels(nil)
		raw, err = json.Marshal(tmp)
		require.NoError(t, err)
		updated, err = server.Update(ctx, &UpdateRequest{
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

		key := &ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
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

	t.Run("playlist restore", func(t *testing.T) {
		uid := "zzz"
		raw := []byte(`{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "fdgsv37qslr0ga",
				"namespace": "default",
				"uid": "` + uid + `",
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

		key := &ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr",
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		// create
		created, err := server.Create(ctx, &CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.NoError(t, err)

		// make sure it exists
		found, err := server.Read(ctx, &ReadRequest{Key: key})
		require.NoError(t, err)
		require.Nil(t, found.Error)
		fmt.Println(found.ResourceVersion)

		// delete it
		deleted, err := server.Delete(ctx, &DeleteRequest{Key: key, ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)
		require.True(t, deleted.ResourceVersion > created.ResourceVersion)

		// restore it
		restored, err := server.Restore(ctx, &RestoreRequest{
			Key:             key,
			ResourceVersion: found.ResourceVersion,
		})
		require.NoError(t, err)
		require.Nil(t, restored.Error)
		require.True(t, restored.ResourceVersion > deleted.ResourceVersion)

		// ensure it exists now
		found, err = server.Read(ctx, &ReadRequest{Key: key})
		require.NoError(t, err)
		require.Nil(t, found.Error)
		require.Equal(t, restored.ResourceVersion, found.ResourceVersion)
		foundUnstructured := &unstructured.Unstructured{}
		err = foundUnstructured.UnmarshalJSON(found.Value)
		require.NoError(t, err)
		foundObj, err := utils.MetaAccessor(foundUnstructured)
		require.NoError(t, err)
		// the UID should be different now
		require.NotEqual(t, uid, string(foundObj.GetUID()))
	})
}
