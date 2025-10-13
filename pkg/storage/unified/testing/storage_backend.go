package test

import (
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Test names for the storage backend test suite
const (
	TestHappyPath        = "happy path"
	TestWatchWriteEvents = "watch write events from latest"
	TestList             = "list"
	TestBlobSupport      = "blob support"
	TestGetResourceStats = "get resource stats"
	TestListHistory      = "list history"
)

type NewBackendFunc func(ctx context.Context) resource.StorageBackend

// TestOptions configures which tests to run
type TestOptions struct {
	SkipTests map[string]bool // tests to skip

}

// RunStorageBackendTest runs the storage backend test suite
func RunStorageBackendTest(t *testing.T, newBackend NewBackendFunc, opts *TestOptions) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	if opts == nil {
		opts = &TestOptions{}
	}

	cases := []struct {
		name string
		fn   func(*testing.T, resource.StorageBackend)
	}{
		{TestHappyPath, runTestIntegrationBackendHappyPath},
		{TestWatchWriteEvents, runTestIntegrationBackendWatchWriteEvents},
		{TestList, runTestIntegrationBackendList},
		{TestBlobSupport, runTestIntegrationBlobSupport},
		{TestGetResourceStats, runTestIntegrationBackendGetResourceStats},
		{TestListHistory, runTestIntegrationBackendListHistory},
	}

	for _, tc := range cases {
		if shouldSkip := opts.SkipTests[tc.name]; shouldSkip {
			t.Logf("Skipping test: %s", tc.name)
			continue
		}

		t.Run(tc.name, func(t *testing.T) {
			tc.fn(t, newBackend(context.Background()))
		})
	}
}

func runTestIntegrationBackendHappyPath(t *testing.T, backend resource.StorageBackend) {
	ctx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
		Rest: authn.AccessTokenClaims{},
	}))

	server := newServer(t, backend)

	stream, err := backend.WatchWriteEvents(context.Background()) // Using a different context to avoid canceling the stream after the DefaultContextTimeout
	require.NoError(t, err)
	var rv1, rv2, rv3, rv4, rv5 int64

	t.Run("Add 3 resources", func(t *testing.T) {
		rv1, err = writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)
		require.NoError(t, err)
		require.Greater(t, rv1, int64(0))

		rv2, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED)
		require.NoError(t, err)
		require.Greater(t, rv2, rv1)

		rv3, err = writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED)
		require.NoError(t, err)
		require.Greater(t, rv3, rv2)
	})

	t.Run("Update item2", func(t *testing.T) {
		rv4, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_MODIFIED)
		require.NoError(t, err)
		require.Greater(t, rv4, rv3)
	})

	t.Run("Delete item1", func(t *testing.T) {
		rv5, err = writeEvent(ctx, backend, "item1", resource.WatchEvent_DELETED)
		require.NoError(t, err)
		require.Greater(t, rv5, rv4)
	})

	t.Run("Read latest item 2", func(t *testing.T) {
		resp := backend.ReadResource(ctx, &resource.ReadRequest{Key: resourceKey("item2")})
		require.Nil(t, resp.Error)
		require.Equal(t, rv4, resp.ResourceVersion)
		require.Equal(t, "item2 MODIFIED", string(resp.Value))
		require.Equal(t, "folderuid", resp.Folder)
	})

	t.Run("Read early version of item2", func(t *testing.T) {
		resp := backend.ReadResource(ctx, &resource.ReadRequest{
			Key:             resourceKey("item2"),
			ResourceVersion: rv3, // item2 was created at rv2 and updated at rv4
		})
		require.Nil(t, resp.Error)
		require.Equal(t, rv2, resp.ResourceVersion)
		require.Equal(t, "item2 ADDED", string(resp.Value))
	})

	t.Run("List latest", func(t *testing.T) {
		resp, err := server.List(ctx, &resource.ListRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, resp.Error)
		require.Len(t, resp.Items, 2)
		require.Equal(t, "item2 MODIFIED", string(resp.Items[0].Value))
		require.Equal(t, "item3 ADDED", string(resp.Items[1].Value))
		require.GreaterOrEqual(t, resp.ResourceVersion, rv5) // rv5 is the latest resource version
	})

	t.Run("Watch events", func(t *testing.T) {
		event := <-stream
		require.Equal(t, "item1", event.Key.Name)
		require.Equal(t, rv1, event.ResourceVersion)
		require.Equal(t, resource.WatchEvent_ADDED, event.Type)
		require.Equal(t, "folderuid", event.Folder)

		event = <-stream
		require.Equal(t, "item2", event.Key.Name)
		require.Equal(t, rv2, event.ResourceVersion)
		require.Equal(t, resource.WatchEvent_ADDED, event.Type)
		require.Equal(t, "folderuid", event.Folder)

		event = <-stream
		require.Equal(t, "item3", event.Key.Name)
		require.Equal(t, rv3, event.ResourceVersion)
		require.Equal(t, resource.WatchEvent_ADDED, event.Type)

		event = <-stream
		require.Equal(t, "item2", event.Key.Name)
		require.Equal(t, rv4, event.ResourceVersion)
		require.Equal(t, resource.WatchEvent_MODIFIED, event.Type)

		event = <-stream
		require.Equal(t, "item1", event.Key.Name)
		require.Equal(t, rv5, event.ResourceVersion)
		require.Equal(t, resource.WatchEvent_DELETED, event.Type)
	})
}

func runTestIntegrationBackendGetResourceStats(t *testing.T, backend resource.StorageBackend) {
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))

	sortFunc := func(a, b resource.ResourceStats) int {
		if a.Namespace != b.Namespace {
			return strings.Compare(a.Namespace, b.Namespace)
		}
		if a.Group != b.Group {
			return strings.Compare(a.Group, b.Group)
		}
		return strings.Compare(a.Resource, b.Resource)
	}
	// Create resources across different namespaces/groups
	_, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED,
		WithNamespace("ns1"),
		WithGroup("group"),
		WithResource("resource1"))
	require.NoError(t, err)

	_, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED,
		WithNamespace("ns1"),
		WithGroup("group"),
		WithResource("resource1"))
	require.NoError(t, err)

	_, err = writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED,
		WithNamespace("ns1"),
		WithGroup("group"),
		WithResource("resource2"))
	require.NoError(t, err)

	_, err = writeEvent(ctx, backend, "item4", resource.WatchEvent_ADDED,
		WithNamespace("ns2"),
		WithGroup("group"),
		WithResource("resource1"))
	require.NoError(t, err)

	_, err = writeEvent(ctx, backend, "item5", resource.WatchEvent_ADDED,
		WithNamespace("ns2"),
		WithGroup("group"),
		WithResource("resource1"))
	require.NoError(t, err)

	t.Run("Get stats for ns1", func(t *testing.T) {
		stats, err := backend.GetResourceStats(ctx, "ns1", 0)
		require.NoError(t, err)
		require.Len(t, stats, 2)

		// Sort results for consistent testing
		slices.SortFunc(stats, sortFunc)

		// Check first resource stats
		require.Equal(t, "ns1", stats[0].Namespace)
		require.Equal(t, "group", stats[0].Group)
		require.Equal(t, "resource1", stats[0].Resource)
		require.Equal(t, int64(2), stats[0].Count)
		require.Greater(t, stats[0].ResourceVersion, int64(0))

		// Check second resource stats
		require.Equal(t, "ns1", stats[1].Namespace)
		require.Equal(t, "group", stats[1].Group)
		require.Equal(t, "resource2", stats[1].Resource)
		require.Equal(t, int64(1), stats[1].Count)
		require.Greater(t, stats[1].ResourceVersion, int64(0))
	})

	t.Run("Get stats for ns2", func(t *testing.T) {
		stats, err := backend.GetResourceStats(ctx, "ns2", 0)
		require.NoError(t, err)
		require.Len(t, stats, 1)

		require.Equal(t, "ns2", stats[0].Namespace)
		require.Equal(t, "group", stats[0].Group)
		require.Equal(t, "resource1", stats[0].Resource)
		require.Equal(t, int64(2), stats[0].Count)
		require.Greater(t, stats[0].ResourceVersion, int64(0))
	})

	t.Run("Get stats with minimum count", func(t *testing.T) {
		stats, err := backend.GetResourceStats(ctx, "ns1", 1)
		require.NoError(t, err)
		require.Len(t, stats, 1)

		require.Equal(t, "ns1", stats[0].Namespace)
		require.Equal(t, "group", stats[0].Group)
		require.Equal(t, "resource1", stats[0].Resource)
		require.Equal(t, int64(2), stats[0].Count)
	})

	t.Run("Get stats for non-existent namespace", func(t *testing.T) {
		stats, err := backend.GetResourceStats(ctx, "non-existent", 0)
		require.NoError(t, err)
		require.Empty(t, stats)
	})
}

func runTestIntegrationBackendWatchWriteEvents(t *testing.T, backend resource.StorageBackend) {
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))

	// Create a few resources before initing the watch
	_, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)
	require.NoError(t, err)

	// Start the watch
	stream, err := backend.WatchWriteEvents(ctx)
	require.NoError(t, err)

	// Create one more event
	_, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED)
	require.NoError(t, err)
	require.Equal(t, "item2", (<-stream).Key.Name)

	// Should close the stream
	ctx.Cancel()

	_, ok := <-stream
	require.False(t, ok)
}

func runTestIntegrationBackendList(t *testing.T, backend resource.StorageBackend) {
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	server := newServer(t, backend)

	// Create a few resources before starting the watch
	rv1, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)
	require.NoError(t, err)
	require.Greater(t, rv1, int64(0))
	rv2, err := writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED)
	require.NoError(t, err)
	require.Greater(t, rv2, rv1)
	rv3, err := writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED)
	require.NoError(t, err)
	require.Greater(t, rv3, rv2)
	rv4, err := writeEvent(ctx, backend, "item4", resource.WatchEvent_ADDED)
	require.NoError(t, err)
	require.Greater(t, rv4, rv3)
	rv5, err := writeEvent(ctx, backend, "item5", resource.WatchEvent_ADDED)
	require.NoError(t, err)
	require.Greater(t, rv5, rv4)
	rv6, err := writeEvent(ctx, backend, "item2", resource.WatchEvent_MODIFIED)
	require.NoError(t, err)
	require.Greater(t, rv6, rv5)
	rv7, err := writeEvent(ctx, backend, "item3", resource.WatchEvent_DELETED)
	require.NoError(t, err)
	require.Greater(t, rv7, rv6)
	rv8, err := writeEvent(ctx, backend, "item6", resource.WatchEvent_ADDED)
	require.NoError(t, err)
	require.Greater(t, rv8, rv7)

	t.Run("fetch all latest", func(t *testing.T) {
		res, err := server.List(ctx, &resource.ListRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 5)
		// should be sorted by key ASC
		require.Equal(t, "item1 ADDED", string(res.Items[0].Value))
		require.Equal(t, "item2 MODIFIED", string(res.Items[1].Value))
		require.Equal(t, "item4 ADDED", string(res.Items[2].Value))
		require.Equal(t, "item5 ADDED", string(res.Items[3].Value))
		require.Equal(t, "item6 ADDED", string(res.Items[4].Value))

		require.Empty(t, res.NextPageToken)
	})

	t.Run("list latest first page ", func(t *testing.T) {
		res, err := server.List(ctx, &resource.ListRequest{
			Limit: 3,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 3)
		continueToken, err := resource.GetContinueToken(res.NextPageToken)
		require.NoError(t, err)
		require.Equal(t, "item1 ADDED", string(res.Items[0].Value))
		require.Equal(t, "item2 MODIFIED", string(res.Items[1].Value))
		require.Equal(t, "item4 ADDED", string(res.Items[2].Value))
		require.GreaterOrEqual(t, continueToken.ResourceVersion, rv8)
	})

	t.Run("list at revision", func(t *testing.T) {
		res, err := server.List(ctx, &resource.ListRequest{
			ResourceVersion: rv4,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 4)
		require.Equal(t, "item1 ADDED", string(res.Items[0].Value))
		require.Equal(t, "item2 ADDED", string(res.Items[1].Value))
		require.Equal(t, "item3 ADDED", string(res.Items[2].Value))
		require.Equal(t, "item4 ADDED", string(res.Items[3].Value))
		require.Empty(t, res.NextPageToken)
	})

	t.Run("fetch first page at revision with limit", func(t *testing.T) {
		res, err := server.List(ctx, &resource.ListRequest{
			Limit:           3,
			ResourceVersion: rv7,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		require.NoError(t, err)
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 3)
		t.Log(res.Items)
		require.Equal(t, "item1 ADDED", string(res.Items[0].Value))
		require.Equal(t, "item2 MODIFIED", string(res.Items[1].Value))
		require.Equal(t, "item4 ADDED", string(res.Items[2].Value))

		continueToken, err := resource.GetContinueToken(res.NextPageToken)
		require.NoError(t, err)
		require.Equal(t, rv7, continueToken.ResourceVersion)
	})

	t.Run("fetch second page at revision", func(t *testing.T) {
		continueToken := &resource.ContinueToken{
			ResourceVersion: rv8,
			StartOffset:     2,
		}
		res, err := server.List(ctx, &resource.ListRequest{
			NextPageToken: continueToken.String(),
			Limit:         2,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 2)
		t.Log(res.Items)
		require.Equal(t, "item4 ADDED", string(res.Items[0].Value))
		require.Equal(t, "item5 ADDED", string(res.Items[1].Value))

		continueToken, err = resource.GetContinueToken(res.NextPageToken)
		require.NoError(t, err)
		require.Equal(t, rv8, continueToken.ResourceVersion)
		require.Equal(t, int64(4), continueToken.StartOffset)
	})
}

func runTestIntegrationBackendListHistory(t *testing.T, backend resource.StorageBackend) {
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	server := newServer(t, backend)

	rv1, _ := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)
	require.Greater(t, rv1, int64(0))

	// add 5 events for item1 - should be saved to history
	rvHistory1, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED)
	require.NoError(t, err)
	require.Greater(t, rvHistory1, rv1)
	rvHistory2, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED)
	require.NoError(t, err)
	require.Greater(t, rvHistory2, rvHistory1)
	rvHistory3, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED)
	require.NoError(t, err)
	require.Greater(t, rvHistory3, rvHistory2)
	rvHistory4, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED)
	require.NoError(t, err)
	require.Greater(t, rvHistory4, rvHistory3)
	rvHistory5, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED)
	require.NoError(t, err)
	require.Greater(t, rvHistory5, rvHistory4)

	t.Run("fetch first history page at revision with limit", func(t *testing.T) {
		res, err := server.List(ctx, &resource.ListRequest{
			Limit:  3,
			Source: resource.ListRequest_HISTORY,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
					Name:      "item1",
				},
			},
		})
		require.NoError(t, err)
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 3)
		t.Log(res.Items)
		// should be in desc order, so the newest RVs are returned first
		require.Equal(t, "item1 MODIFIED", string(res.Items[0].Value))
		require.Equal(t, rvHistory5, res.Items[0].ResourceVersion)
		require.Equal(t, "item1 MODIFIED", string(res.Items[1].Value))
		require.Equal(t, rvHistory4, res.Items[1].ResourceVersion)
		require.Equal(t, "item1 MODIFIED", string(res.Items[2].Value))
		require.Equal(t, rvHistory3, res.Items[2].ResourceVersion)

		continueToken, err := resource.GetContinueToken(res.NextPageToken)
		require.NoError(t, err)
		//  should return the furthest back RV as the next page token
		require.Equal(t, rvHistory3, continueToken.ResourceVersion)
	})

	t.Run("fetch second page of history at revision", func(t *testing.T) {
		continueToken := &resource.ContinueToken{
			ResourceVersion: rvHistory3,
			StartOffset:     2,
		}
		res, err := server.List(ctx, &resource.ListRequest{
			NextPageToken: continueToken.String(),
			Limit:         2,
			Source:        resource.ListRequest_HISTORY,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
					Name:      "item1",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 2)
		t.Log(res.Items)
		require.Equal(t, "item1 MODIFIED", string(res.Items[0].Value))
		require.Equal(t, rvHistory2, res.Items[0].ResourceVersion)
		require.Equal(t, "item1 MODIFIED", string(res.Items[1].Value))
		require.Equal(t, rvHistory1, res.Items[1].ResourceVersion)
	})
}

func runTestIntegrationBlobSupport(t *testing.T, backend resource.StorageBackend) {
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	server := newServer(t, backend)
	store, ok := backend.(resource.BlobSupport)
	require.True(t, ok)

	t.Run("put and fetch blob", func(t *testing.T) {
		key := &resource.ResourceKey{
			Namespace: "ns",
			Group:     "g",
			Resource:  "r",
			Name:      "n",
		}

		b1, err := server.PutBlob(ctx, &resource.PutBlobRequest{
			Resource:    key,
			Method:      resource.PutBlobRequest_GRPC,
			ContentType: "plain/text",
			Value:       []byte("hello 11111"),
		})
		require.NoError(t, err)
		require.Nil(t, b1.Error)
		require.Equal(t, "c894ae57bd227b8f8c63f38a2ddf458b", b1.Hash)

		b2, err := server.PutBlob(ctx, &resource.PutBlobRequest{
			Resource:    key,
			Method:      resource.PutBlobRequest_GRPC,
			ContentType: "plain/text",
			Value:       []byte("hello 22222"), // the most recent
		})
		require.NoError(t, err)
		require.Nil(t, b2.Error)
		require.Equal(t, "b0da48de4ff92e0ad0d836de4d746937", b2.Hash)

		// Check that we can still access both values
		found, err := store.GetResourceBlob(ctx, key, &utils.BlobInfo{UID: b1.Uid}, true)
		require.NoError(t, err)
		require.Equal(t, []byte("hello 11111"), found.Value)

		found, err = store.GetResourceBlob(ctx, key, &utils.BlobInfo{UID: b2.Uid}, true)
		require.NoError(t, err)
		require.Equal(t, []byte("hello 22222"), found.Value)

		// Save a resource with annotation
		obj := &unstructured.Unstructured{}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetBlob(&utils.BlobInfo{UID: b2.Uid, Hash: b1.Hash})
		meta.SetName(key.Name)
		meta.SetNamespace(key.Namespace)
		obj.SetAPIVersion(key.Group + "/v1")
		obj.SetKind("Test")
		val, err := obj.MarshalJSON()
		require.NoError(t, err)
		out, err := server.Create(ctx, &resource.CreateRequest{Key: key, Value: val})
		require.NoError(t, err)
		require.Nil(t, out.Error)
		require.True(t, out.ResourceVersion > 0)

		// The server (not store!) will lookup the saved annotation and return the correct payload
		res, err := server.GetBlob(ctx, &resource.GetBlobRequest{Resource: key})
		require.NoError(t, err)
		require.Nil(t, out.Error)
		require.Equal(t, "hello 22222", string(res.Value))

		// But we can still get an older version with an explicit UID
		res, err = server.GetBlob(ctx, &resource.GetBlobRequest{Resource: key, Uid: b1.Uid})
		require.NoError(t, err)
		require.Nil(t, out.Error)
		require.Equal(t, "hello 11111", string(res.Value))
	})
}

// WriteEventOption is a function that modifies WriteEventOptions
type WriteEventOption func(*WriteEventOptions)

// WithNamespace sets the namespace for the write event
func WithNamespace(namespace string) WriteEventOption {
	return func(o *WriteEventOptions) {
		o.Namespace = namespace
	}
}

// WithGroup sets the group for the write event
func WithGroup(group string) WriteEventOption {
	return func(o *WriteEventOptions) {
		o.Group = group
	}
}

// WithResource sets the resource for the write event
func WithResource(resource string) WriteEventOption {
	return func(o *WriteEventOptions) {
		o.Resource = resource
	}
}

// WithFolder sets the folder for the write event
func WithFolder(folder string) WriteEventOption {
	return func(o *WriteEventOptions) {
		o.Folder = folder
	}
}

// WithValue sets the value for the write event
func WithValue(value []byte) WriteEventOption {
	return func(o *WriteEventOptions) {
		o.Value = value
	}
}

type WriteEventOptions struct {
	Namespace string
	Group     string
	Resource  string
	Folder    string
	Value     []byte
}

func writeEvent(ctx context.Context, store resource.StorageBackend, name string, action resource.WatchEvent_Type, opts ...WriteEventOption) (int64, error) {
	// Default options
	options := WriteEventOptions{
		Namespace: "namespace",
		Group:     "group",
		Resource:  "resource",
		Folder:    "folderuid",
	}

	// Apply options
	for _, opt := range opts {
		opt(&options)
	}

	// Set default value if not provided
	if options.Value == nil {
		options.Value = []byte(name + " " + resource.WatchEvent_Type_name[int32(action)])
	}

	res := &unstructured.Unstructured{
		Object: map[string]any{},
	}
	meta, err := utils.MetaAccessor(res)
	if err != nil {
		return 0, err
	}
	meta.SetFolder(options.Folder)

	return store.WriteEvent(ctx, resource.WriteEvent{
		Type:  action,
		Value: options.Value,
		Key: &resource.ResourceKey{
			Namespace: options.Namespace,
			Group:     options.Group,
			Resource:  options.Resource,
			Name:      name,
		},
		Object: meta,
	})
}

func resourceKey(name string) *resource.ResourceKey {
	return &resource.ResourceKey{
		Namespace: "namespace",
		Group:     "group",
		Resource:  "resource",
		Name:      name,
	}
}

func newServer(t *testing.T, b resource.StorageBackend) resource.ResourceServer {
	t.Helper()

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: b,
	})
	require.NoError(t, err)
	require.NotNil(t, server)

	return server
}
