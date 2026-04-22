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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
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

		// Update should return a conflict error the second time

		_, err = server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)

		rsp, err := server.Update(ctx, &resourcepb.UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)
		require.Equal(t, int32(http.StatusConflict), rsp.Error.Code)
		require.Contains(t, rsp.Error.Message, "requested RV does not match current RV")
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

func TestGetQuotaUsage(t *testing.T) {
	ctx := context.Background()

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

		// Create a real OverridesService with the temp file
		overridesService, err := NewOverridesService(ctx, log.NewNopLogger(), prometheus.NewRegistry(), tracing.NewNoopTracerService(), ReloadOptions{
			FilePath: tmpFile,
		})
		require.NoError(t, err)
		require.NoError(t, overridesService.init(ctx))
		defer func() {
			_ = overridesService.stop(ctx)
		}()

		// Create a mock backend that returns resource stats (reusing mockStorageBackend from search_test.go)
		mockBackend := &mockStorageBackend{
			resourceStats: []ResourceStats{{Count: 42}},
		}

		s := &server{
			backend:          mockBackend,
			overridesService: overridesService,
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
		require.Nil(t, resp.Error)
		assert.Equal(t, int64(42), resp.Usage)
		assert.Equal(t, int64(500), resp.Limit)
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
			ctx := context.Background()

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

			server, err := NewResourceServer(ResourceServerOptions{
				Backend: &mockStorageBackend{
					resourceStats: []ResourceStats{{
						NamespacedResource: nsr,
						Count:              1,
					}},
				},
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

func TestPeriodicBookmarks(t *testing.T) {
	testUser := &identity.StaticRequester{
		Type:           authlib.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	group := "playlist.grafana.app"
	resource := "playlists"
	namespace := "default"

	var counter int
	createPlaylist := func(testCtx context.Context, srv *server) error {
		counter += 1
		name := fmt.Sprintf("bookmark-test-%d", counter)

		value := []byte(`{
		"apiVersion": "playlist.grafana.app/v0alpha1",
		"kind": "Playlist",
		"metadata": {
			"name": "` + name + `",
			"namespace": "` + namespace + `",
			"uid": "` + fmt.Sprintf("bm-test-uid-%d", counter) + `",
			"annotations": {
				"grafana.app/repoName": "test",
				"grafana.app/repoPath": "path/to/item",
				"grafana.app/repoTimestamp": "2024-02-02T00:00:00Z"
			}
		},
		"spec": {
			"title": "` + fmt.Sprintf("playlist %d", counter) + `",
			"interval": "5m",
			"items": [{"type": "dashboard_by_uid", "value": "abc"}]
		}
	}`)

		key := &resourcepb.ResourceKey{
			Group:     group,
			Resource:  resource,
			Namespace: namespace,
			Name:      name,
		}

		ctx := authlib.WithAuthInfo(testCtx, testUser)
		created, err := srv.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: value})
		if err != nil {
			return err
		}
		if created.Error != nil {
			return fmt.Errorf("creating playlist: %v", created.Error)
		}

		return nil
	}

	setup := func(t *testing.T) *server {
		t.Helper()
		db, err := badger.Open(badger.DefaultOptions("").
			WithInMemory(true).
			WithLogger(nil))
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, db.Close()) })

		kv := NewBadgerKV(db)
		store, err := NewKVStorageBackend(KVBackendOptions{
			KvStore:      kv,
			WatchOptions: WatchOptions{SettleDelay: 1 * time.Millisecond},
		})
		require.NoError(t, err)

		srv, err := NewResourceServer(ResourceServerOptions{
			Backend:           store,
			BookmarkFrequency: 50 * time.Millisecond,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = srv.Stop(stopCtx)
		})

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
						Group:    group,
						Resource: resource,
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
						Group:    group,
						Resource: resource,
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
						Group:    group,
						Resource: resource,
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

// callbackAccessClient is a test helper whose Check behavior can be swapped between calls.
type callbackAccessClient struct {
	fn func(req authlib.CheckRequest, folder string) (authlib.CheckResponse, error)
}

func (c *callbackAccessClient) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return c.fn(req, folder)
}

func (c *callbackAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(_, _ string) bool { return true }, authlib.NoopZookie{}, nil
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
}
