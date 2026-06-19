package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	badger "github.com/dgraph-io/badger/v4"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
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

	// Create in-memory BadgerDB for testing
	db, err := badger.Open(badger.DefaultOptions("").
		WithInMemory(true).
		WithLogger(nil))
	require.NoError(t, err)
	defer func() {
		err := db.Close()
		require.NoError(t, err)
	}()

	kv := NewBadgerKV(db)
	store, err := NewKVStorageBackend(KVBackendOptions{
		KvStore: kv,
	})
	require.NoError(t, err)

	server, err := NewResourceServer(ResourceServerOptions{
		Backend: store,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = server.Stop(ctx)
	})

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

		// Try again with a direct query
		all, err = server.List(ctx, &resourcepb.ListRequest{Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Fields: []*resourcepb.Requirement{{
				Key:      "metadata.name",
				Operator: "=",
				Values:   []string{"not-matching"},
			}},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 0)

		// This time matching
		all, err = server.List(ctx, &resourcepb.ListRequest{Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Fields: []*resourcepb.Requirement{{
				Key:      "metadata.name",
				Operator: "=",
				Values:   []string{"fdgsv37qslr0ga"},
			}},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 1)
		require.Equal(t, raw, all.Items[0].Value)

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

	t.Run("playlist FAIL CRUD paths due to invalid key", func(t *testing.T) {
		raw := []byte(`{
    		"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "fdgsv37#qslr0ga",
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

		// invalid group
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app###",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		created, err := server.Create(ctx, &resourcepb.CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.Error(t, err)
		require.Nil(t, created)
		require.Equal(t, codes.InvalidArgument, status.Code(err))

		// invalid resource
		key = &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr###", // can be anything :(
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		created, err = server.Create(ctx, &resourcepb.CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.Error(t, err)
		require.Nil(t, created)
		require.Equal(t, codes.InvalidArgument, status.Code(err))

		// invalid namespace
		key = &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default###",
			Name:      "fdgsv37qslr0ga",
		}

		created, err = server.Create(ctx, &resourcepb.CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.Error(t, err)
		require.Nil(t, created)
		require.Equal(t, codes.InvalidArgument, status.Code(err))

		// invalid name
		key = &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default",
			Name:      "fdgsv37qslr0g###",
		}

		created, err = server.Create(ctx, &resourcepb.CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.Error(t, err)
		require.Nil(t, created)
		require.Equal(t, codes.InvalidArgument, status.Code(err))

		// legacy name - valid
		key = &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default",
			Name:      "2c7e5361-7360-4d2a-ae45-5e79bba458d6",
		}

		created, err = server.Create(ctx, &resourcepb.CreateRequest{
			Value: raw,
			Key:   key,
		})

		require.NoError(t, err)
		require.NotNil(t, created)

		// legacy name - also valid
		key = &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default",
			Name:      "IvIsO_YGz",
		}

		created, err = server.Create(ctx, &resourcepb.CreateRequest{
			Value: raw,
			Key:   key,
		})

		require.NoError(t, err)
		require.NotNil(t, created)

		// legacy name - also valid
		key = &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default",
			Name:      "_IvIsOYGz",
		}

		created, err = server.Create(ctx, &resourcepb.CreateRequest{
			Value: raw,
			Key:   key,
		})

		require.NoError(t, err)
		require.NotNil(t, created)

		invalidQualifiedNames := []string{
			"",                                     // empty
			strings.Repeat("1", 260),               // too long
			"    ",                                 // only spaces
			"f8cc010c.ee72.4681;89d2+d46e1bd47d33", // invalid chars
		}

		// group
		for _, invalidGroup := range invalidQualifiedNames {
			key = &resourcepb.ResourceKey{
				Group:     invalidGroup,
				Resource:  "rrrr", // can be anything :(
				Namespace: "default",
				Name:      "_IvIsOYGz",
			}

			created, err = server.Create(ctx, &resourcepb.CreateRequest{
				Value: raw,
				Key:   key,
			})

			require.Error(t, err)
			require.Nil(t, created)
			require.Equal(t, codes.InvalidArgument, status.Code(err))
		}

		// resource
		for _, invalidResource := range invalidQualifiedNames {
			key = &resourcepb.ResourceKey{
				Group:     "playlist.grafana.app",
				Resource:  invalidResource,
				Namespace: "default",
				Name:      "_IvIsOYGz",
			}

			created, err = server.Create(ctx, &resourcepb.CreateRequest{
				Value: raw,
				Key:   key,
			})

			require.Error(t, err)
			require.Nil(t, created)
			require.Equal(t, codes.InvalidArgument, status.Code(err))
		}

		// namespace
		for _, invalidNamespace := range invalidQualifiedNames {
			if invalidNamespace == "" {
				// empty namespace is allowed
				continue
			}

			key = &resourcepb.ResourceKey{
				Group:     "playlist.grafana.app",
				Resource:  "rrrr", // can be anything :(
				Namespace: invalidNamespace,
				Name:      "_IvIsOYGz",
			}

			created, err = server.Create(ctx, &resourcepb.CreateRequest{
				Value: raw,
				Key:   key,
			})

			require.Error(t, err)
			require.Nil(t, created)
			require.Equal(t, codes.InvalidArgument, status.Code(err))
		}
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

		// First update with different bytes advances the resource version.
		rawV2 := []byte(strings.Replace(string(raw), `"title": "hello"`, `"title": "world"`, 1))
		_, err = server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           rawV2,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)

		// Second update with stale RV and different bytes should return a conflict.
		rawV3 := []byte(strings.Replace(string(raw), `"title": "hello"`, `"title": "again"`, 1))
		rsp, err := server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           rawV3,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)
		require.Equal(t, int32(http.StatusConflict), rsp.Error.Code)
		require.Contains(t, rsp.Error.Message, "requested RV does not match current RV")
	})

	t.Run("playlist update with identical bytes does not increment RV", func(t *testing.T) {
		raw := []byte(`{
    	"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "noop-rv-check",
				"namespace": "default",
				"uid": "noop-uid"
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
			Resource:  "rrrr",
			Namespace: "default",
			Name:      "noop-rv-check",
		}

		created, err := server.Create(ctx, &resourcepb.CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.NoError(t, err)
		require.Nil(t, created.Error)

		rsp, err := server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.Equal(t, created.ResourceVersion, rsp.ResourceVersion, "RV should not change when bytes are identical")

		// The stored resource version should also be unchanged.
		read := server.backend.ReadResource(ctx, &resourcepb.ReadRequest{Key: key})
		require.Nil(t, read.Error)
		require.Equal(t, created.ResourceVersion, read.ResourceVersion)
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

	t.Run("should use cluster-scoped tenant for empty tenantID", func(t *testing.T) {
		s, _ := newTestServerWithQueue(t, 1, 1)
		executed := make(chan bool, 1)

		runnable := func(ctx context.Context) {
			executed <- true
		}

		err := s.runInQueue(context.Background(), "", runnable)
		require.NoError(t, err)
		assert.True(t, <-executed, "runnable should have been executed with cluster-scoped tenantID")
	})

	t.Run("should return an error if queue is consistently full after retrying", func(t *testing.T) {
		s, q := newTestServerWithQueue(t, 1, 1)
		// Task 1: This will be picked up by the worker and block it.
		blocker := make(chan struct{})
		defer close(blocker)
		blockingRunnable := func() {
			<-blocker
		}
		err := q.Enqueue(context.Background(), testTenantID, blockingRunnable)
		require.NoError(t, err)
		for q.Len() > 0 {
			time.Sleep(100 * time.Millisecond)
		}
		err = q.Enqueue(context.Background(), testTenantID, blockingRunnable)
		require.NoError(t, err)

		// Task 2: This runnable should never execute because the queue is full.
		mu := sync.Mutex{}
		executed := false
		runnable := func(ctx context.Context) {
			mu.Lock()
			defer mu.Unlock()
			executed = true
		}

		err = s.runInQueue(context.Background(), testTenantID, runnable)
		require.Error(t, err)
		require.ErrorIs(t, err, scheduler.ErrTenantQueueFull)
		require.False(t, executed, "runnable should not have been executed")
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
		err := services.StopAndAwaitTerminated(context.Background(), q)
		require.NoError(t, err)
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
		err := services.StopAndAwaitTerminated(context.Background(), worker)
		require.NoError(t, err)
	})

	s := &server{
		queue: q,
		queueConfig: QueueConfig{
			Timeout:    500 * time.Millisecond,
			MaxRetries: 2,
			MinBackoff: 10 * time.Millisecond,
		},
		log: log.NewNopLogger(),
	}
	return s, q
}

func TestArtificialDelayAfterSuccessfulOperation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	s := &server{
		artificialSuccessfulWriteDelay: 1 * time.Millisecond,
		log:                            log.NewNopLogger(),
	}

	check := func(t *testing.T, expectedSleep bool, res responseWithErrorResult, err error) {
		slept := s.sleepAfterSuccessfulWriteOperation(ctx, "test", &resourcepb.ResourceKey{}, res, err)
		require.Equal(t, expectedSleep, slept)
	}

	// Successful responses should sleep
	check(t, true, nil, nil)

	check(t, true, (responseWithErrorResult)((*resourcepb.CreateResponse)(nil)), nil)
	check(t, true, &resourcepb.CreateResponse{}, nil)

	check(t, true, (responseWithErrorResult)((*resourcepb.UpdateResponse)(nil)), nil)
	check(t, true, &resourcepb.UpdateResponse{}, nil)

	check(t, true, (responseWithErrorResult)((*resourcepb.DeleteResponse)(nil)), nil)
	check(t, true, &resourcepb.DeleteResponse{}, nil)

	// Failed responses should return without sleeping
	check(t, false, nil, errors.New("some error"))
	check(t, false, &resourcepb.CreateResponse{Error: AsErrorResult(errors.New("some error"))}, nil)
	check(t, false, &resourcepb.UpdateResponse{Error: AsErrorResult(errors.New("some error"))}, nil)
	check(t, false, &resourcepb.DeleteResponse{Error: AsErrorResult(errors.New("some error"))}, nil)
}

func TestArtificialDelaySkippedWhenPushOnWrite(t *testing.T) {
	ctx := t.Context()
	s := &server{
		artificialSuccessfulWriteDelay: 1 * time.Millisecond,
		log:                            log.NewNopLogger(),
		search: &searchServer{
			useSearchEngine: true,
			engineHooks: SearchEngineHooks{
				PushOnWrite: true,
			},
		},
	}
	require.False(t, s.sleepAfterSuccessfulWriteOperation(ctx, "test", &resourcepb.ResourceKey{}, &resourcepb.CreateResponse{}, nil))
}

func TestGetQuotaUsage(t *testing.T) {
	ctx := t.Context()

	t.Run("returns error when overrides service is not configured", func(t *testing.T) {
		s := &server{
			overridesService: nil,
			log:              log.NewNopLogger(),
		}

		resp, err := s.GetQuotaUsage(ctx, &resourcepb.QuotaUsageRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: "stacks-123",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp.Error)
		assert.Equal(t, int32(http.StatusNotImplemented), resp.Error.Code)
		assert.Equal(t, "overrides service not configured on resource server", resp.Error.Message)
	})

	t.Run("returns usage and limit successfully", func(t *testing.T) {
		// Create a temporary overrides config file
		tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
		content := `overrides:
  "123":
    quotas:
      dashboard.grafana.app/dashboards:
        limit: 500
`
		require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))

		overridesService, err := NewOverridesService(ctx, log.NewNopLogger(), prometheus.NewRegistry(), tracing.NewNoopTracerService(), ReloadOptions{
			FilePath: tmpFile,
		})
		require.NoError(t, err)

		// Stats flow through GetStats -> searchClient.
		searchClient := newFakeResourceIndexClient()
		searchClient.statsResponse = &resourcepb.ResourceStatsResponse{
			Stats: []*resourcepb.ResourceStatsResponse_Stats{{
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Count:    42,
			}},
		}

		s, err := NewResourceServer(ResourceServerOptions{
			Backend:          &mockStorageBackend{},
			SearchClient:     searchClient,
			OverridesService: overridesService,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = s.Stop(ctx)
		})

		resp, err := s.GetQuotaUsage(ctx, &resourcepb.QuotaUsageRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: "stacks-123",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
		})
		require.NoError(t, err)
		require.Nil(t, resp.Error)
		assert.Equal(t, int64(42), resp.Usage)
		assert.Equal(t, int64(500), resp.Limit)
	})

	t.Run("surfaces stats response error on the response", func(t *testing.T) {
		tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
		content := `overrides:
  "123":
    quotas:
      dashboard.grafana.app/dashboards:
        limit: 500
`
		require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))

		overridesService, err := NewOverridesService(ctx, log.NewNopLogger(), prometheus.NewRegistry(), tracing.NewNoopTracerService(), ReloadOptions{
			FilePath: tmpFile,
		})
		require.NoError(t, err)

		searchClient := newFakeResourceIndexClient()
		searchClient.statsResponse = &resourcepb.ResourceStatsResponse{
			Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: "stats blew up"},
		}

		s, err := NewResourceServer(ResourceServerOptions{
			Backend:          &mockStorageBackend{},
			SearchClient:     searchClient,
			OverridesService: overridesService,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = s.Stop(ctx)
		})

		resp, err := s.GetQuotaUsage(ctx, &resourcepb.QuotaUsageRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: "stacks-123",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp.Error)
		assert.Equal(t, int32(http.StatusInternalServerError), resp.Error.Code)
		assert.Equal(t, "stats blew up", resp.Error.Message)
	})
}

func TestCheckQuotas(t *testing.T) {
	tests := []struct {
		name              string
		limit             int
		enforcedResources map[string]bool
		expectError       bool
	}{
		{
			name:              "enforced resource returns error if quota exceeded",
			limit:             1,
			enforcedResources: map[string]bool{"grafana.dashboard.app/dashboards": true},
			expectError:       true,
		},
		{
			name:              "enforced resource returns nil if within quota",
			limit:             2,
			enforcedResources: map[string]bool{"grafana.dashboard.app/dashboards": true},
			expectError:       false,
		},
		{
			name:              "unlisted resource is not enforced even if over quota",
			limit:             1,
			enforcedResources: map[string]bool{"grafana.folder.app/folders": true},
			expectError:       false,
		},
		{
			name:              "empty enforced resources means no enforcement",
			limit:             1,
			enforcedResources: nil,
			expectError:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := t.Context()

			overridesFile := filepath.Join(t.TempDir(), "overrides.yaml")
			overrides := fmt.Sprintf(`overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: %d
`, tt.limit)
			require.NoError(t, os.WriteFile(overridesFile, []byte(overrides), 0644))

			tcr := tracing.NewNoopTracerService()
			overridesService, err := NewOverridesService(ctx, log.NewNopLogger(), prometheus.NewRegistry(), tcr.Tracer, ReloadOptions{
				FilePath: overridesFile,
			})
			require.NoError(t, err)

			nsr := NamespacedResource{
				Namespace: "stacks-123",
				Group:     "grafana.dashboard.app",
				Resource:  "dashboards",
			}

			searchClient := newFakeResourceIndexClient()
			searchClient.statsResponse = &resourcepb.ResourceStatsResponse{
				Stats: []*resourcepb.ResourceStatsResponse_Stats{{
					Group:    nsr.Group,
					Resource: nsr.Resource,
					Count:    1,
				}},
			}

			server, err := NewResourceServer(ResourceServerOptions{
				Backend:          &mockStorageBackend{},
				SearchClient:     searchClient,
				OverridesService: overridesService,
				QuotasConfig:     QuotasConfig{EnforcedResources: tt.enforcedResources},
			})
			require.NoError(t, err)
			t.Cleanup(func() {
				_ = server.Stop(ctx)
			})

			err = server.checkQuota(ctx, nsr)
			if tt.expectError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}

	t.Run("stats response error fails open (no quota error returned)", func(t *testing.T) {
		ctx := t.Context()

		overridesFile := filepath.Join(t.TempDir(), "overrides.yaml")
		overrides := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1
`
		require.NoError(t, os.WriteFile(overridesFile, []byte(overrides), 0644))

		tcr := tracing.NewNoopTracerService()
		overridesService, err := NewOverridesService(ctx, log.NewNopLogger(), prometheus.NewRegistry(), tcr.Tracer, ReloadOptions{
			FilePath: overridesFile,
		})
		require.NoError(t, err)

		nsr := NamespacedResource{
			Namespace: "stacks-123",
			Group:     "grafana.dashboard.app",
			Resource:  "dashboards",
		}

		searchClient := newFakeResourceIndexClient()
		searchClient.statsResponse = &resourcepb.ResourceStatsResponse{
			Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: "stats blew up"},
		}

		server, err := NewResourceServer(ResourceServerOptions{
			Backend:          &mockStorageBackend{},
			SearchClient:     searchClient,
			OverridesService: overridesService,
			QuotasConfig:     QuotasConfig{EnforcedResources: map[string]bool{"grafana.dashboard.app/dashboards": true}},
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = server.Stop(ctx)
		})

		require.NoError(t, server.checkQuota(ctx, nsr))
	})
}

func TestNewResourceServer_RequiresStatsSourceWhenQuotasEnabled(t *testing.T) {
	ctx := t.Context()

	overridesFile := filepath.Join(t.TempDir(), "overrides.yaml")
	overrides := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1
`
	require.NoError(t, os.WriteFile(overridesFile, []byte(overrides), 0644))

	tcr := tracing.NewNoopTracerService()
	overridesService, err := NewOverridesService(ctx, log.NewNopLogger(), prometheus.NewRegistry(), tcr.Tracer, ReloadOptions{
		FilePath: overridesFile,
	})
	require.NoError(t, err)

	t.Run("errors when neither search server nor search client is configured", func(t *testing.T) {
		_, err := NewResourceServer(ResourceServerOptions{
			Backend:          &mockStorageBackend{},
			OverridesService: overridesService,
		})
		require.Error(t, err)
	})

	t.Run("succeeds when a search client is configured", func(t *testing.T) {
		server, err := NewResourceServer(ResourceServerOptions{
			Backend:          &mockStorageBackend{},
			SearchClient:     newFakeResourceIndexClient(),
			OverridesService: overridesService,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = server.Stop(ctx)
		})
	})
}

func TestShouldEnforce(t *testing.T) {
	tests := []struct {
		name     string
		config   QuotasConfig
		group    string
		resource string
		expected bool
	}{
		{
			name:     "returns true for listed resource",
			config:   QuotasConfig{EnforcedResources: map[string]bool{"dashboard.grafana.app/dashboards": true}},
			group:    "dashboard.grafana.app",
			resource: "dashboards",
			expected: true,
		},
		{
			name:     "returns false for unlisted resource",
			config:   QuotasConfig{EnforcedResources: map[string]bool{"dashboard.grafana.app/dashboards": true}},
			group:    "folder.grafana.app",
			resource: "folders",
			expected: false,
		},
		{
			name:     "returns false when map is nil",
			config:   QuotasConfig{},
			group:    "dashboard.grafana.app",
			resource: "dashboards",
			expected: false,
		},
		{
			name:     "returns false when map is empty",
			config:   QuotasConfig{EnforcedResources: map[string]bool{}},
			group:    "dashboard.grafana.app",
			resource: "dashboards",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.config.ShouldEnforce(tt.group, tt.resource))
		})
	}
}

func Test_resourceVersionTime(t *testing.T) {
	// Reference time: 2026-01-15 12:00:00 UTC
	refTime := time.Date(2026, 1, 15, 12, 0, 0, 0, time.UTC)

	// Build a snowflake ID for refTime (node=0, sequence=0).
	snowflakeRV := (refTime.UnixMilli() - snowflake.Epoch) << (snowflake.NodeBits + snowflake.StepBits)

	// Build a microsecond Unix timestamp for refTime (SQL backend format).
	microRV := refTime.UnixMicro()

	tests := []struct {
		name      string
		rv        int64
		wantClose time.Time
	}{
		{
			name:      "snowflake ID",
			rv:        snowflakeRV,
			wantClose: refTime,
		},
		{
			name:      "microsecond timestamp",
			rv:        microRV,
			wantClose: refTime,
		},
		{
			name:      "zero",
			rv:        0,
			wantClose: time.UnixMicro(0),
		},
		{
			name:      "negative",
			rv:        -1,
			wantClose: time.UnixMicro(-1),
		},
		{
			name:      "small positive",
			rv:        12345,
			wantClose: time.UnixMicro(12345),
		},
		{
			name:      "sequential counter",
			rv:        1000000,
			wantClose: time.UnixMicro(1000000),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resourceVersionTime(tt.rv)
			diff := got.Sub(tt.wantClose).Abs()
			require.Less(t, diff, time.Second,
				"expected time close to %v, got %v (diff %v)", tt.wantClose, got, diff)
		})
	}
}

func TestGracefulShutdown(t *testing.T) {
	testUser := &identity.StaticRequester{
		Type:           authlib.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
	}
	ctx := authlib.WithAuthInfo(context.Background(), testUser)

	raw := []byte(`{
		"apiVersion": "playlist.grafana.app/v0alpha1",
		"kind": "Playlist",
		"metadata": {
			"name": "test-shutdown",
			"uid": "shutdown-uid",
			"namespace": "default"
		},
		"spec": { "title": "hello", "interval": "5m" }
	}`)

	key := &resourcepb.ResourceKey{
		Group:     "playlist.grafana.app",
		Resource:  "playlists",
		Namespace: "default",
		Name:      "test-shutdown",
	}

	newServer := func(t *testing.T) *server {
		t.Helper()
		db, err := badger.Open(badger.DefaultOptions("").
			WithInMemory(true).
			WithLogger(nil))
		require.NoError(t, err)
		t.Cleanup(func() { _ = db.Close() })

		kvStore := NewBadgerKV(db)
		store, err := NewKVStorageBackend(KVBackendOptions{
			KvStore: kvStore,
		})
		require.NoError(t, err)

		srv, err := NewResourceServer(ResourceServerOptions{
			Backend: store,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = srv.Stop(ctx)
		})
		return srv
	}

	t.Run("rejects new writes after Stop is called", func(t *testing.T) {
		srv := newServer(t)

		// Stop the server
		err := srv.Stop(context.Background())
		require.NoError(t, err)

		// Create should be rejected
		_, err = srv.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: raw})
		require.Error(t, err)
		require.Contains(t, err.Error(), "server is stopping")

		// Update should be rejected
		_, err = srv.Update(ctx, &resourcepb.UpdateRequest{Key: key, Value: raw})
		require.Error(t, err)
		require.Contains(t, err.Error(), "server is stopping")

		// Delete should be rejected
		_, err = srv.Delete(ctx, &resourcepb.DeleteRequest{Key: key})
		require.Error(t, err)
		require.Contains(t, err.Error(), "server is stopping")
	})

	t.Run("Stop waits for in-flight write to complete", func(t *testing.T) {
		srv := newServer(t)

		// Start a Create in a goroutine — it will be in-flight when Stop is called
		writeStarted := make(chan struct{})
		writeDone := make(chan struct{})

		// Use artificialSuccessfulWriteDelay to keep the write in-flight long enough
		// for us to call Stop while it's still running
		srv.artificialSuccessfulWriteDelay = 500 * time.Millisecond

		go func() {
			close(writeStarted)
			_, _ = srv.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: raw})
			close(writeDone)
		}()

		<-writeStarted
		// Give the goroutine time to enter Create and call inflight.Add(1)
		time.Sleep(50 * time.Millisecond)

		// Stop should block until the in-flight write completes
		stopDone := make(chan struct{})
		go func() {
			_ = srv.Stop(context.Background())
			close(stopDone)
		}()

		// The write should finish before Stop returns
		select {
		case <-writeDone:
			// expected: write finished
		case <-time.After(5 * time.Second):
			t.Fatal("timed out waiting for in-flight write to complete")
		}

		select {
		case <-stopDone:
			// expected: Stop returned after write completed
		case <-time.After(5 * time.Second):
			t.Fatal("timed out waiting for Stop to return")
		}
	})

	t.Run("Stop respects context deadline when writes are stuck", func(t *testing.T) {
		srv := newServer(t)

		// Simulate a very slow write by using a large delay
		srv.artificialSuccessfulWriteDelay = 10 * time.Second

		writeStarted := make(chan struct{})
		go func() {
			close(writeStarted)
			_, _ = srv.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: raw})
		}()

		<-writeStarted
		time.Sleep(50 * time.Millisecond)

		// Stop with a short deadline — should not wait forever
		stopCtx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		defer cancel()

		stopDone := make(chan struct{})
		go func() {
			_ = srv.Stop(stopCtx)
			close(stopDone)
		}()

		select {
		case <-stopDone:
			// expected: Stop returned after timeout, not after the 10s write
		case <-time.After(5 * time.Second):
			t.Fatal("Stop did not respect context deadline")
		}
	})
}

// mockWatchServer implements resourcepb.ResourceStore_WatchServer for testing.
type mockWatchServer struct {
	grpc.ServerStream
	ctx    context.Context
	events chan *resourcepb.WatchEvent
}

func newMockWatchServer(ctx context.Context) *mockWatchServer {
	return &mockWatchServer{
		ctx:    ctx,
		events: make(chan *resourcepb.WatchEvent, 100),
	}
}

func (m *mockWatchServer) Send(evt *resourcepb.WatchEvent) error {
	select {
	case <-m.ctx.Done():
		return m.ctx.Err()
	case m.events <- evt:
		return nil
	}
}

func (m *mockWatchServer) Context() context.Context     { return m.ctx }
func (m *mockWatchServer) SetHeader(metadata.MD) error  { return nil }
func (m *mockWatchServer) SendHeader(metadata.MD) error { return nil }
func (m *mockWatchServer) SetTrailer(metadata.MD)       {}
func (m *mockWatchServer) SendMsg(any) error            { return nil }
func (m *mockWatchServer) RecvMsg(any) error            { return nil }

const (
	watchTestGroup     = "playlist.grafana.app"
	watchTestResource  = "playlists"
	watchTestNamespace = "default"
)

func newWatchTestUser() *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:           authlib.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
	}
}

type watchTestServerOpts struct {
	BookmarkFrequency time.Duration
	StorageMetrics    *StorageMetrics
	AccessClient      authlib.AccessClient
}

func newWatchTestServer(t *testing.T, opts watchTestServerOpts) *server {
	t.Helper()
	db, err := badger.Open(badger.DefaultOptions("").
		WithInMemory(true).
		WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	store, err := NewKVStorageBackend(KVBackendOptions{
		KvStore:      NewBadgerKV(db),
		WatchOptions: WatchOptions{SettleDelay: 1 * time.Millisecond},
	})
	require.NoError(t, err)

	srv, err := NewResourceServer(ResourceServerOptions{
		Backend:           store,
		BookmarkFrequency: opts.BookmarkFrequency,
		StorageMetrics:    opts.StorageMetrics,
		AccessClient:      opts.AccessClient,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})
	return srv
}

var playlistCounter int

// createTestPlaylist creates a playlist resource with a unique auto-generated
// name. ctx must already carry auth info.
func createTestPlaylist(ctx context.Context, srv *server) error {
	playlistCounter++
	name := fmt.Sprintf("playlist-%d", playlistCounter)
	value := []byte(`{
		"apiVersion": "playlist.grafana.app/v0alpha1",
		"kind": "Playlist",
		"metadata": {
			"name": "` + name + `",
			"namespace": "` + watchTestNamespace + `",
			"uid": "uid-` + name + `"
		},
		"spec": {
			"title": "` + name + `",
			"interval": "5m",
			"items": [{"type": "dashboard_by_uid", "value": "abc"}]
		}
	}`)
	key := &resourcepb.ResourceKey{
		Group:     watchTestGroup,
		Resource:  watchTestResource,
		Namespace: watchTestNamespace,
		Name:      name,
	}
	created, err := srv.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: value})
	if err != nil {
		return err
	}
	if created.Error != nil {
		return fmt.Errorf("creating playlist %q: %v", name, created.Error)
	}
	return nil
}

func TestPeriodicBookmarks(t *testing.T) {
	testUser := newWatchTestUser()

	createPlaylist := func(testCtx context.Context, srv *server) error {
		return createTestPlaylist(authlib.WithAuthInfo(testCtx, testUser), srv)
	}

	setup := func(t *testing.T) *server {
		t.Helper()
		srv := newWatchTestServer(t, watchTestServerOpts{BookmarkFrequency: 50 * time.Millisecond})
		// Create a resource so initial events backfill produces a non-zero RV.
		require.NoError(t, createPlaylist(t.Context(), srv))
		return srv
	}

	waitForBookmarks := func(t *testing.T, mock *mockWatchServer, expected int) (bool, []*resourcepb.WatchEvent) {
		var bookmarks []*resourcepb.WatchEvent
		for {
			select {
			case evt := <-mock.events:
				if evt.Type == resourcepb.WatchEvent_BOOKMARK {
					bookmarks = append(bookmarks, evt)
					if expected > 0 && len(bookmarks) >= expected {
						return false, bookmarks
					}
				}
			case <-time.After(time.Second):
				return true, bookmarks
			}
		}
	}

	t.Run("bookmarks sent periodically when AllowWatchBookmarks is true and there are new RVs to report", func(t *testing.T) {
		srv := setup(t)
		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), testUser))
		defer cancel()

		mock := newMockWatchServer(ctx)

		var eg errgroup.Group
		eg.Go(func() error {
			return srv.Watch(&resourcepb.WatchRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Group:    watchTestGroup,
						Resource: watchTestResource,
					},
				},
				SendInitialEvents:   true,
				AllowWatchBookmarks: true,
			}, mock)
		})

		// keep creating resources, so that new bookmarks are sent
		eg.Go(func() error {
			ticker := time.NewTicker(20 * time.Millisecond)
			for {
				select {
				case <-ticker.C:
					if err := createPlaylist(t.Context(), srv); err != nil {
						return err
					}

				case <-ctx.Done():
					return nil
				}
			}
		})

		// Collect events until we see at least 2 bookmarks (initial + periodic) or timeout.
		timedOut, bookmarks := waitForBookmarks(t, mock, 2)
		require.False(t, timedOut, "timed out waiting for bookmarks", "expected: 2, got: %d", len(bookmarks))

		cancel() // stop the watch
		require.NoError(t, eg.Wait())

		// Bookmarks should have increasing RVs.
		require.Greater(t, bookmarks[0].Resource.Version, int64(0))
		require.Greater(t, bookmarks[1].Resource.Version, bookmarks[0].Resource.Version)
	})

	t.Run("bookmarks are not repeated when AllowWatchBookmarks is true and no resources were created", func(t *testing.T) {
		srv := setup(t)
		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), testUser))
		defer cancel()

		mock := newMockWatchServer(ctx)

		var eg errgroup.Group
		eg.Go(func() error {
			return srv.Watch(&resourcepb.WatchRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Group:    watchTestGroup,
						Resource: watchTestResource,
					},
				},
				SendInitialEvents:   true,
				AllowWatchBookmarks: true,
			}, mock)
		})

		// Collect all bookmarks for the next 1s.
		_, bookmarks := waitForBookmarks(t, mock, 0)
		cancel() // stop the watch
		require.NoError(t, eg.Wait())

		// Bookmarks should have increasing RVs.
		require.Len(t, bookmarks, 1)
		require.Greater(t, bookmarks[0].Resource.Version, int64(0))
	})

	t.Run("no bookmarks when AllowWatchBookmarks is false", func(t *testing.T) {
		srv := setup(t)
		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), testUser))
		defer cancel()

		mock := newMockWatchServer(ctx)
		var eg errgroup.Group
		eg.Go(func() error {
			return srv.Watch(&resourcepb.WatchRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Group:    watchTestGroup,
						Resource: watchTestResource,
					},
				},
				SendInitialEvents:   true,
				AllowWatchBookmarks: false,
			}, mock)
		})

		// Collect all bookmarks for the next 1s.
		_, bookmarks := waitForBookmarks(t, mock, 0)
		cancel()
		require.NoError(t, eg.Wait())

		require.Empty(t, bookmarks)
	})
}

// stubWatchServer is a ResourceStore_WatchServer mock whose Send returns a
// caller-supplied error. It is used to exercise Watch's error handling without
// relying on races between the watch context and concrete Send failures.
type stubWatchServer struct {
	grpc.ServerStream
	ctx     context.Context
	sendErr error
}

func (s *stubWatchServer) Send(*resourcepb.WatchEvent) error { return s.sendErr }
func (s *stubWatchServer) Context() context.Context          { return s.ctx }
func (s *stubWatchServer) SetHeader(metadata.MD) error       { return nil }
func (s *stubWatchServer) SendHeader(metadata.MD) error      { return nil }
func (s *stubWatchServer) SetTrailer(metadata.MD)            {}
func (s *stubWatchServer) SendMsg(any) error                 { return nil }
func (s *stubWatchServer) RecvMsg(any) error                 { return nil }

// TestWatchContextCancellation pins down how Watch translates errors that
// surface during context cancellation. The watch loop has an explicit
// `case <-ctx.Done(): return nil` branch, but `select` is nondeterministic, so
// when the context is canceled we may instead run a Send/Read that returns
// the context error. Watch must treat that as a clean shutdown, while still
// surfacing unrelated errors and context errors that did not originate from
// our own context.
func TestWatchContextCancellation(t *testing.T) {
	testUser := newWatchTestUser()

	watchReq := &resourcepb.WatchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:    watchTestGroup,
				Resource: watchTestResource,
			},
		},
		// SendInitialEvents forces Watch to call Send during the backfill, so
		// the configured stub error path is hit deterministically without
		// having to race with the bookmark ticker or the broadcaster.
		SendInitialEvents: true,
	}

	setup := func(t *testing.T) *server {
		t.Helper()
		srv := newWatchTestServer(t, watchTestServerOpts{})
		require.NoError(t, createTestPlaylist(authlib.WithAuthInfo(t.Context(), testUser), srv))
		return srv
	}

	t.Run("returns nil when own context is canceled", func(t *testing.T) {
		srv := setup(t)
		ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), testUser))
		cancel()

		// Whatever sendErr we configure, Watch should swallow it because the
		// context error from our own ctx will always be the proximate cause.
		stub := &stubWatchServer{ctx: ctx, sendErr: context.Canceled}
		require.NoError(t, srv.Watch(watchReq, stub))
	})

	t.Run("propagates non-context Send errors", func(t *testing.T) {
		srv := setup(t)
		ctx := authlib.WithAuthInfo(t.Context(), testUser)

		sentinel := errors.New("send failed")
		stub := &stubWatchServer{ctx: ctx, sendErr: sentinel}
		err := srv.Watch(watchReq, stub)
		require.ErrorIs(t, err, sentinel)
	})

	t.Run("propagates context errors that did not come from our own context", func(t *testing.T) {
		srv := setup(t)
		// Own context is alive; a Send returning context.Canceled here must
		// have come from somewhere else and is a real error to report.
		ctx := authlib.WithAuthInfo(t.Context(), testUser)

		stub := &stubWatchServer{ctx: ctx, sendErr: context.Canceled}
		err := srv.Watch(watchReq, stub)
		require.ErrorIs(t, err, context.Canceled)
	})
}

// TestWatchEventMetricsWithSinceRV makes sure that we don't emit watch delay metrics when replaying
// cached events for clients that start watching from old RVs. The metric should only be reporting
// data for events emitted after the Watch is setup.
func TestWatchEventMetricsWithSinceRV(t *testing.T) {
	testUser := newWatchTestUser()

	reg := prometheus.NewPedanticRegistry()
	metrics := ProvideStorageMetrics(reg)
	srv := newWatchTestServer(t, watchTestServerOpts{StorageMetrics: metrics})

	ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), testUser))
	defer cancel()

	// Create two resources before the watch starts. The broadcaster will absorb
	// these events into its replay cache and hand them to any future subscriber.
	require.NoError(t, createTestPlaylist(ctx, srv))
	require.NoError(t, createTestPlaylist(ctx, srv))

	// Wait until the broadcaster has received both events, so the cache is
	// populated by the time we subscribe.
	requireMetricEventually(t, metrics.Broadcaster.EventsReceivedTotal.WithLabelValues(watchTestResource), 2)

	// Start a watch with a tiny Since RV.
	mock := newMockWatchServer(ctx)
	var eg errgroup.Group
	eg.Go(func() error {
		return srv.Watch(&resourcepb.WatchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{Group: watchTestGroup, Resource: watchTestResource},
			},
			Since: 42,
		}, mock)
	})

	// Wait for the subscription to register before producing the third event.
	requireMetricEventually(t, metrics.Broadcaster.Subscribers.WithLabelValues(watchTestResource), 1)

	// Create a third resource after the watch has subscribed. This is the only
	// event for which WatchEventLatency should record an observation.
	require.NoError(t, createTestPlaylist(ctx, srv))

	// Wait until the mock has received all three events (two replayed from the
	// cache + one live).
	received := 0
	timeout := time.After(5 * time.Second)
	for received < 3 {
		select {
		case evt := <-mock.events:
			if evt.Type == resourcepb.WatchEvent_ADDED {
				received++
			}
		case <-timeout:
			t.Fatalf("timed out waiting for events: got %d, want %d", received, 3)
		}
	}

	cancel()
	require.NoError(t, eg.Wait())

	// Replayed cache entries are catch-up traffic, not "late" deliveries —
	// observing them inflates the histogram with the time elapsed since they
	// were originally written, not the actual reaction time of this watcher.
	// Only the post-subscription event should be counted.
	obs, err := metrics.WatchEventLatency.GetMetricWithLabelValues(watchTestResource)
	require.NoError(t, err)
	m := &dto.Metric{}
	require.NoError(t, obs.(prometheus.Metric).Write(m))
	require.Equal(t, uint64(1), m.Histogram.GetSampleCount(),
		"WatchEventLatency should only observe events that arrived after the subscription started")
}

// TestWatchInitialEventsRespectsItemChecker tests that checker is used for
// initial-events when SendInitialEvents=true.
func TestWatchInitialEventsRespectsItemChecker(t *testing.T) {
	const (
		allowedFolder = "folder-a"
		deniedFolder  = "folder-b"
		allowedName   = "allowed-playlist"
		deniedName    = "denied-playlist"
	)

	ac := &callbackAccessClient{
		fn: func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			// Only fail reads, allow other verbs to seed test resources
			if req.Verb == utils.VerbGet && folder != allowedFolder {
				return deny()
			}
			return allow()
		},
	}
	srv := newWatchTestServer(t, watchTestServerOpts{AccessClient: ac})

	user := newWatchTestUser()
	ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), user))
	defer cancel()

	for _, item := range []struct {
		name, folder string
	}{
		{allowedName, allowedFolder},
		{deniedName, deniedFolder},
	} {
		value := []byte(`{"apiVersion":"playlist.grafana.app/v0alpha1","kind":"Playlist","metadata":{"name":"` + item.name + `","uid":"uid-` + item.name + `","namespace":"` + watchTestNamespace + `","annotations":{"grafana.app/folder":"` + item.folder + `"}},"spec":{"title":"t","interval":"5m","items":[]}}`)
		created, err := srv.Create(ctx, &resourcepb.CreateRequest{
			Key: &resourcepb.ResourceKey{
				Group:     watchTestGroup,
				Resource:  watchTestResource,
				Namespace: watchTestNamespace,
				Name:      item.name,
			},
			Value: value,
		})
		require.NoError(t, err)
		require.Nil(t, created.Error, "creating seed resource %q", item.name)
	}

	mock := newMockWatchServer(ctx)
	var eg errgroup.Group
	eg.Go(func() error {
		return srv.Watch(&resourcepb.WatchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     watchTestGroup,
					Resource:  watchTestResource,
					Namespace: watchTestNamespace,
				},
			},
			SendInitialEvents: true,
		}, mock)
	})

	// Drain events
	var added []*resourcepb.WatchEvent
	deadline := time.After(2 * time.Second)
drain:
	for {
		select {
		case evt := <-mock.events:
			if evt.Type == resourcepb.WatchEvent_ADDED {
				added = append(added, evt)
			}
		case <-deadline:
			break drain
		}
	}

	cancel()
	require.NoError(t, eg.Wait())

	for _, evt := range added {
		require.NotContains(t, string(evt.Resource.Value), `"name":"`+deniedName+`"`)
	}
	require.Len(t, added, 1)
	require.Contains(t, string(added[0].Resource.Value), `"name":"`+allowedName+`"`)
}

// callbackAccessClient is a test helper whose Check behavior can be swapped between calls.
// Compile returns an ItemChecker that delegates to the same fn (with Verb=get),
// so a single callback drives both Check and per-item authorization.
type callbackAccessClient struct {
	fn func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error)
}

func (c *callbackAccessClient) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return c.fn(req, folder)
}

func (c *callbackAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(name, folder string) bool {
		resp, err := c.fn(authlib.CheckRequest{
			Verb:      utils.VerbGet,
			Group:     req.Group,
			Resource:  req.Resource,
			Namespace: req.Namespace,
			Name:      name,
		}, folder)
		if err != nil {
			return false
		}
		return resp.Allowed
	}, authlib.NoopZookie{}, nil
}

func (c *callbackAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, item := range req.Checks {
		res, err := c.fn(authlib.CheckRequest{Verb: item.Verb, Group: item.Group, Resource: item.Resource, Name: item.Name}, item.Folder)
		results[item.CorrelationID] = authlib.BatchCheckResult{Allowed: res.Allowed, Error: err}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

func allow() (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: true, Zookie: authlib.NoopZookie{}}, nil
}

func deny() (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: false, Zookie: authlib.NoopZookie{}}, nil
}

func TestNewEventPermissionChecks(t *testing.T) {
	user := &identity.StaticRequester{
		Type:      authlib.TypeUser,
		Login:     "testuser",
		UserID:    123,
		UserUID:   "u123",
		OrgRole:   identity.RoleEditor,
		Namespace: "default",
	}
	ctx := authlib.WithAuthInfo(context.Background(), user)

	const (
		group     = "playlist.grafana.app"
		resource  = "playlists"
		namespace = "default"
		name      = "test-resource"
		folderA   = "folder-a"
		folderB   = "folder-b"
	)

	makeValue := func(folder string) []byte {
		annotations := `"grafana.app/repoName":"test","grafana.app/repoPath":"p","grafana.app/repoTimestamp":"2024-01-01T00:00:00Z"`
		if folder != "" {
			annotations += `,"grafana.app/folder":"` + folder + `"`
		}
		return []byte(`{"apiVersion":"playlist.grafana.app/v0alpha1","kind":"Playlist","metadata":{"name":"` + name + `","uid":"test-uid","namespace":"` + namespace + `","annotations":{` + annotations + `}},"spec":{"title":"t","interval":"5m","items":[]}}`)
	}

	key := &resourcepb.ResourceKey{
		Group:     group,
		Resource:  resource,
		Namespace: namespace,
		Name:      name,
	}

	newServer := func(t *testing.T, ac authlib.AccessClient) *server {
		t.Helper()
		db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
		require.NoError(t, err)
		t.Cleanup(func() { _ = db.Close() })

		kv := NewBadgerKV(db)
		store, err := NewKVStorageBackend(KVBackendOptions{KvStore: kv})
		require.NoError(t, err)

		srv, err := NewResourceServer(ResourceServerOptions{
			Backend:      store,
			AccessClient: ac,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = srv.Stop(stopCtx)
		})
		return srv
	}

	// createResource creates a resource using an always-allow client,
	// then replaces the server's access client with ac for subsequent calls.
	createThenSwitch := func(t *testing.T, value []byte, ac *callbackAccessClient) *server {
		t.Helper()
		srv := newServer(t, ac)
		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return allow() }
		created, err := srv.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: value})
		require.NoError(t, err)
		require.Nil(t, created.Error)
		return srv
	}

	t.Run("regular update is denied when user lacks update permission", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(""), ac)

		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return deny() }

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		rsp, err := srv.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           makeValue(""),
			ResourceVersion: latest.ResourceVersion,
		})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, int32(http.StatusForbidden), rsp.Error.Code)
	})

	t.Run("regular update is allowed when user has update permission", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(""), ac)

		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return allow() }

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		rsp, err := srv.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           makeValue(""),
			ResourceVersion: latest.ResourceVersion,
		})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
	})

	t.Run("create is denied when user lacks create permission", func(t *testing.T) {
		ac := &callbackAccessClient{
			fn: func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return deny() },
		}
		srv := newServer(t, ac)

		rsp, err := srv.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: makeValue("")})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, int32(http.StatusForbidden), rsp.Error.Code)
	})

	t.Run("folder move is denied when user cannot update in source folder", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(folderA), ac)

		// Deny update on the source folder, allow everything else.
		ac.fn = func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			if req.Verb == "update" && folder == folderA {
				return deny()
			}
			return allow()
		}

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		rsp, err := srv.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           makeValue(folderB), // move to folder-b
			ResourceVersion: latest.ResourceVersion,
		})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, int32(http.StatusForbidden), rsp.Error.Code)
		require.Contains(t, rsp.Error.Message, "not allowed to update resource in the source folder")
	})

	t.Run("folder move is denied when user cannot create in destination folder", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(folderA), ac)

		// Allow update on source, deny create on destination.
		ac.fn = func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			if req.Verb == "create" && folder == folderB {
				return deny()
			}
			return allow()
		}

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		rsp, err := srv.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           makeValue(folderB),
			ResourceVersion: latest.ResourceVersion,
		})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, int32(http.StatusForbidden), rsp.Error.Code)
		require.Contains(t, rsp.Error.Message, "not allowed to create resource in the destination folder")
	})

	t.Run("folder move is allowed when user has permission on both folders", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(folderA), ac)

		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return allow() }

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		rsp, err := srv.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           makeValue(folderB),
			ResourceVersion: latest.ResourceVersion,
		})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
	})

	t.Run("read is denied when user lacks get permission", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(""), ac)

		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return deny() }

		rsp, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, int32(http.StatusForbidden), rsp.Error.Code)
	})

	t.Run("read is allowed when user has get permission", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(""), ac)

		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return allow() }

		rsp, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.NotNil(t, rsp.Value)
	})

	t.Run("read passes the resource folder to the access check", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(folderA), ac)

		var capturedFolder string
		ac.fn = func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			if req.Verb == "get" {
				capturedFolder = folder
			}
			return allow()
		}

		rsp, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.Equal(t, folderA, capturedFolder)
	})

	t.Run("read returns error when access check fails", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(""), ac)

		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{}, errors.New("authz service unavailable")
		}

		rsp, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
	})

	t.Run("delete is denied when user lacks delete permission", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(""), ac)

		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return deny() }

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		rsp, err := srv.Delete(ctx, &resourcepb.DeleteRequest{Key: key, ResourceVersion: latest.ResourceVersion})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, int32(http.StatusForbidden), rsp.Error.Code)
	})

	t.Run("delete is allowed when user has delete permission", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(""), ac)

		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return allow() }

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		rsp, err := srv.Delete(ctx, &resourcepb.DeleteRequest{Key: key, ResourceVersion: latest.ResourceVersion})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
	})

	t.Run("delete passes the resource folder to the access check", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeValue(folderA), ac)

		var capturedFolder string
		ac.fn = func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			if req.Verb == "delete" {
				capturedFolder = folder
			}
			return allow()
		}

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(t, err)
		rsp, err := srv.Delete(ctx, &resourcepb.DeleteRequest{Key: key, ResourceVersion: latest.ResourceVersion})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.Equal(t, folderA, capturedFolder)
	})
}

// TestFolderDeletePermissionChecks verifies that the unified resource server enforces
// authorization correctly when the resource being deleted is itself a folder
// (group=folder.grafana.app, resource=folders). The key difference from generic resources
// is that latest.Folder holds the *parent* folder UID, so the access check must
// receive the parent — not the folder being deleted.
func TestFolderDeletePermissionChecks(t *testing.T) {
	user := &identity.StaticRequester{
		Type:      authlib.TypeUser,
		Login:     "testuser",
		UserID:    123,
		UserUID:   "u123",
		OrgRole:   identity.RoleEditor,
		Namespace: "default",
	}
	ctx := authlib.WithAuthInfo(context.Background(), user)

	const (
		folderGroup     = "folder.grafana.app"
		folderResource  = "folders"
		namespace       = "default"
		folderName      = "child-folder"
		parentFolderUID = "parent-folder"
	)

	// makeFolderValue builds a minimal folder JSON stored in the resource backend.
	// The grafana.app/folder annotation carries the parent folder UID.
	makeFolderValue := func(parentUID string) []byte {
		annotations := `"grafana.app/repoName":"test"`
		if parentUID != "" {
			annotations += `,"grafana.app/folder":"` + parentUID + `"`
		}
		return []byte(`{"apiVersion":"folder.grafana.app/v1","kind":"Folder","metadata":{"name":"` + folderName + `","namespace":"` + namespace + `","annotations":{` + annotations + `}},"spec":{"title":"Child Folder"}}`)
	}

	folderKey := &resourcepb.ResourceKey{
		Group:     folderGroup,
		Resource:  folderResource,
		Namespace: namespace,
		Name:      folderName,
	}

	newServer := func(t *testing.T, ac authlib.AccessClient) *server {
		t.Helper()
		db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
		require.NoError(t, err)
		t.Cleanup(func() { _ = db.Close() })

		kv := NewBadgerKV(db)
		store, err := NewKVStorageBackend(KVBackendOptions{KvStore: kv})
		require.NoError(t, err)

		srv, err := NewResourceServer(ResourceServerOptions{
			Backend:      store,
			AccessClient: ac,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = srv.Stop(stopCtx)
		})
		return srv
	}

	// createThenSwitch creates the folder using an always-allow client,
	// then swaps the access client so subsequent calls use ac.
	createThenSwitch := func(t *testing.T, value []byte, ac *callbackAccessClient) *server {
		t.Helper()
		srv := newServer(t, ac)
		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return allow() }
		created, err := srv.Create(ctx, &resourcepb.CreateRequest{Key: folderKey, Value: value})
		require.NoError(t, err)
		require.Nil(t, created.Error)
		return srv
	}

	t.Run("folder delete is denied when user lacks delete permission", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeFolderValue(parentFolderUID), ac)

		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return deny() }

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: folderKey})
		require.NoError(t, err)
		rsp, err := srv.Delete(ctx, &resourcepb.DeleteRequest{Key: folderKey, ResourceVersion: latest.ResourceVersion})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, int32(http.StatusForbidden), rsp.Error.Code)
	})

	t.Run("folder delete is allowed when user has delete permission", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeFolderValue(parentFolderUID), ac)

		ac.fn = func(_ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) { return allow() }

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: folderKey})
		require.NoError(t, err)
		rsp, err := srv.Delete(ctx, &resourcepb.DeleteRequest{Key: folderKey, ResourceVersion: latest.ResourceVersion})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
	})

	t.Run("folder delete access check receives parent folder uid, not the folder being deleted", func(t *testing.T) {
		ac := &callbackAccessClient{}
		srv := createThenSwitch(t, makeFolderValue(parentFolderUID), ac)

		var capturedReq authlib.CheckRequest
		var capturedFolder string
		ac.fn = func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			if req.Verb == "delete" {
				capturedReq = req
				capturedFolder = folder
			}
			return allow()
		}

		latest, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: folderKey})
		require.NoError(t, err)
		rsp, err := srv.Delete(ctx, &resourcepb.DeleteRequest{Key: folderKey, ResourceVersion: latest.ResourceVersion})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)

		require.Equal(t, "delete", capturedReq.Verb)
		require.Equal(t, folderGroup, capturedReq.Group)
		require.Equal(t, folderResource, capturedReq.Resource)
		require.Equal(t, folderName, capturedReq.Name)
		// The folder context passed to the access check must be the *parent* folder UID,
		// not the UID of the folder being deleted.
		require.Equal(t, parentFolderUID, capturedFolder)
		require.NotEqual(t, folderName, capturedFolder)
	})
}

// stubBlobSupport records whether PutResourceBlob was reached so tests can
// assert that the authz gate short-circuits or delegates.
type stubBlobSupport struct {
	putReached bool
}

func (s *stubBlobSupport) SupportsSignedURLs() bool { return false }

func (s *stubBlobSupport) PutResourceBlob(_ context.Context, _ *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
	s.putReached = true
	return &resourcepb.PutBlobResponse{Uid: "blob-uid"}, nil
}

func (s *stubBlobSupport) GetResourceBlob(_ context.Context, _ *resourcepb.ResourceKey, _ *utils.BlobInfo, _ bool) (*resourcepb.GetBlobResponse, error) {
	return &resourcepb.GetBlobResponse{}, nil
}

// errorOnReadResourceBackend lets tests inject an arbitrary ReadResource
// error to exercise PutBlob's failure passthrough.
type errorOnReadResourceBackend struct {
	StorageBackend
	readErr *resourcepb.ErrorResult
}

func (b *errorOnReadResourceBackend) ReadResource(_ context.Context, _ *resourcepb.ReadRequest) *BackendReadResponse {
	return &BackendReadResponse{Error: b.readErr}
}

// Embedding the StorageBackend interface doesn't promote Stop; without
// this override srv.Stop can't reach the real backend's goroutines and
// goleak flags them.
func (b *errorOnReadResourceBackend) Stop(ctx context.Context) error {
	if s, ok := b.StorageBackend.(ResourceServerStopper); ok {
		return s.Stop(ctx)
	}
	return nil
}

// newBlobAuthzTestServer is the shared fixture for the PutBlob and
// namespace-gate tests. backendWrap is optional and wraps the real KV
// backend so tests can inject ReadResource failures.
func newBlobAuthzTestServer(t *testing.T, backendWrap func(StorageBackend) StorageBackend) (*server, *callbackAccessClient, *stubBlobSupport) {
	t.Helper()
	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	var store StorageBackend
	store, err = NewKVStorageBackend(KVBackendOptions{KvStore: NewBadgerKV(db)})
	require.NoError(t, err)
	if backendWrap != nil {
		store = backendWrap(store)
	}

	ac := &callbackAccessClient{fn: func(authlib.CheckRequest, string) (authlib.CheckResponse, error) { return allow() }}
	blob := &stubBlobSupport{}

	srv, err := NewResourceServer(ResourceServerOptions{
		Backend:      store,
		AccessClient: ac,
		Blob:         BlobConfig{Backend: blob},
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})
	return srv, ac, blob
}

func ctxWithUserInNs(ns string) context.Context {
	return authlib.WithAuthInfo(context.Background(), &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserID:    1,
		UserUID:   "u1",
		Namespace: ns,
	})
}

func TestPutBlobPermissionChecks(t *testing.T) {
	const (
		group     = "playlist.grafana.app"
		resource  = "playlists"
		namespace = "default"
		name      = "test-resource"
	)
	key := &resourcepb.ResourceKey{Group: group, Resource: resource, Namespace: namespace, Name: name}
	value := []byte(`{"apiVersion":"playlist.grafana.app/v0alpha1","kind":"Playlist","metadata":{"name":"` + name + `","uid":"test-uid","namespace":"` + namespace + `"},"spec":{"title":"t","interval":"5m","items":[]}}`)
	ctxWithUser := ctxWithUserInNs(namespace)

	// seedParent makes ReadResource inside PutBlob succeed. ac is left in
	// allow() so callers can flip it before the PutBlob under test.
	seedParent := func(t *testing.T, srv *server, ac *callbackAccessClient) {
		t.Helper()
		ac.fn = func(authlib.CheckRequest, string) (authlib.CheckResponse, error) { return allow() }
		rsp, err := srv.Create(ctxWithUser, &resourcepb.CreateRequest{Key: key, Value: value})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
	}

	t.Run("rejects when no user in context", func(t *testing.T) {
		srv, _, blob := newBlobAuthzTestServer(t, nil)
		rsp, err := srv.PutBlob(context.Background(), &resourcepb.PutBlobRequest{Resource: key})
		require.NoError(t, err)
		require.Equal(t, int32(http.StatusUnauthorized), rsp.Error.Code)
		require.False(t, blob.putReached)
	})

	t.Run("returns 404 when parent resource does not exist", func(t *testing.T) {
		srv, _, blob := newBlobAuthzTestServer(t, nil)
		rsp, err := srv.PutBlob(ctxWithUser, &resourcepb.PutBlobRequest{Resource: key})
		require.NoError(t, err)
		require.Equal(t, int32(http.StatusNotFound), rsp.Error.Code)
		require.False(t, blob.putReached)
	})

	t.Run("rejects with 403 when access.Check denies update on parent", func(t *testing.T) {
		srv, ac, blob := newBlobAuthzTestServer(t, nil)
		seedParent(t, srv, ac)
		ac.fn = func(authlib.CheckRequest, string) (authlib.CheckResponse, error) { return deny() }

		rsp, err := srv.PutBlob(ctxWithUser, &resourcepb.PutBlobRequest{Resource: key})
		require.NoError(t, err)
		require.Equal(t, int32(http.StatusForbidden), rsp.Error.Code)
		require.False(t, blob.putReached)
	})

	t.Run("surfaces access.Check error", func(t *testing.T) {
		srv, ac, blob := newBlobAuthzTestServer(t, nil)
		seedParent(t, srv, ac)
		ac.fn = func(authlib.CheckRequest, string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{}, errors.New("authz backend unavailable")
		}

		rsp, err := srv.PutBlob(ctxWithUser, &resourcepb.PutBlobRequest{Resource: key})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.False(t, blob.putReached)
	})

	t.Run("delegates to blob backend when access.Check allows update on parent", func(t *testing.T) {
		srv, ac, blob := newBlobAuthzTestServer(t, nil)
		seedParent(t, srv, ac)

		var capturedReq authlib.CheckRequest
		var capturedFolder string
		ac.fn = func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			capturedReq, capturedFolder = req, folder
			return allow()
		}

		rsp, err := srv.PutBlob(ctxWithUser, &resourcepb.PutBlobRequest{Resource: key})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.True(t, blob.putReached)
		require.Equal(t, utils.VerbUpdate, capturedReq.Verb)
		require.Equal(t, group, capturedReq.Group)
		require.Equal(t, resource, capturedReq.Resource)
		require.Equal(t, namespace, capturedReq.Namespace)
		require.Equal(t, name, capturedReq.Name)
		require.Equal(t, "", capturedFolder)
	})

	t.Run("propagates backend ReadResource error verbatim", func(t *testing.T) {
		backendErr := &resourcepb.ErrorResult{Code: http.StatusServiceUnavailable, Message: "storage backend unavailable"}
		srv, _, blob := newBlobAuthzTestServer(t, func(real StorageBackend) StorageBackend {
			return &errorOnReadResourceBackend{StorageBackend: real, readErr: backendErr}
		})

		rsp, err := srv.PutBlob(ctxWithUser, &resourcepb.PutBlobRequest{Resource: key})
		require.NoError(t, err)
		require.Equal(t, backendErr.Code, rsp.Error.Code, "must surface the backend error code, not collapse to 404")
		require.Equal(t, backendErr.Message, rsp.Error.Message)
		require.False(t, blob.putReached)
	})
}

func TestRequireUserNamespace(t *testing.T) {
	userInNs := func(ns string, typ authlib.IdentityType) context.Context {
		return authlib.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: typ, Namespace: ns})
	}
	cases := []struct {
		name      string
		ctx       context.Context
		namespace string
		wantCode  int32 // 0 means nil result
	}{
		{"no user in context", context.Background(), "default", http.StatusUnauthorized},
		{"matching namespace", userInNs("default", authlib.TypeUser), "default", 0},
		{"cross-namespace", userInNs("org-1", authlib.TypeUser), "org-2", http.StatusForbidden},
		{"wildcard user", userInNs("*", authlib.TypeAccessPolicy), "org-7", 0},
		// authlib.NamespaceMatches only allows cluster-scoped requests (empty
		// namespace) from callers with the "*" namespace.
		{"tenant user on cluster-scoped request", userInNs("default", authlib.TypeUser), "", http.StatusForbidden},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := requireUserNamespace(c.ctx, c.namespace)
			if c.wantCode == 0 {
				require.Nil(t, got)
				return
			}
			require.NotNil(t, got)
			require.Equal(t, c.wantCode, got.Code)
		})
	}
}

// TestDelegatedRPCsNamespaceGate exercises requireUserNamespace through each
// of the four delegated-only RPCs. Backends are intentionally unconfigured
// so a request that should be rejected must be rejected before delegation.
func TestDelegatedRPCsNamespaceGate(t *testing.T) {
	rpcs := []struct {
		name   string
		invoke func(ctx context.Context, srv *server, ns string) *resourcepb.ErrorResult
	}{
		{"GetBlob", func(ctx context.Context, srv *server, ns string) *resourcepb.ErrorResult {
			rsp, _ := srv.GetBlob(ctx, &resourcepb.GetBlobRequest{
				Resource: &resourcepb.ResourceKey{Namespace: ns, Group: "g", Resource: "r", Name: "n"},
			})
			return rsp.Error
		}},
		{"ListManagedObjects", func(ctx context.Context, srv *server, ns string) *resourcepb.ErrorResult {
			rsp, _ := srv.ListManagedObjects(ctx, &resourcepb.ListManagedObjectsRequest{Namespace: ns})
			return rsp.Error
		}},
		{"CountManagedObjects", func(ctx context.Context, srv *server, ns string) *resourcepb.ErrorResult {
			rsp, _ := srv.CountManagedObjects(ctx, &resourcepb.CountManagedObjectsRequest{Namespace: ns})
			return rsp.Error
		}},
		{"RebuildIndexes", func(ctx context.Context, srv *server, ns string) *resourcepb.ErrorResult {
			rsp, _ := srv.RebuildIndexes(ctx, &resourcepb.RebuildIndexesRequest{Namespace: ns})
			return rsp.Error
		}},
	}
	scenarios := []struct {
		name     string
		ctx      context.Context
		reqNs    string
		wantCode int32
	}{
		{"missing user", context.Background(), "org-1", http.StatusUnauthorized},
		{"cross-namespace", ctxWithUserInNs("org-1"), "org-2", http.StatusForbidden},
	}
	for _, rpc := range rpcs {
		for _, sc := range scenarios {
			t.Run(rpc.name+"/"+sc.name, func(t *testing.T) {
				srv, _, _ := newBlobAuthzTestServer(t, nil)
				got := rpc.invoke(sc.ctx, srv, sc.reqNs)
				require.NotNil(t, got)
				require.Equal(t, sc.wantCode, got.Code)
			})
		}
	}
}

func TestGetBlob_RejectsMissingResourceKey(t *testing.T) {
	srv, _, _ := newBlobAuthzTestServer(t, nil)
	rsp, err := srv.GetBlob(ctxWithUserInNs("org-1"), &resourcepb.GetBlobRequest{Uid: "blob-uid"})
	require.NoError(t, err)
	require.Equal(t, int32(http.StatusBadRequest), rsp.Error.Code)
}
