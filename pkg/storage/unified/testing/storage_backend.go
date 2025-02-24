package test

import (
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
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

type storageBackendSuite struct {
	suite.Suite
	newBackend NewBackendFunc
	opts       *TestOptions
}

func NewStorageBackendSuite(t *testing.T, newBackend NewBackendFunc, opts *TestOptions) *storageBackendSuite {
	if opts == nil {
		opts = &TestOptions{}
	}
	s := &storageBackendSuite{
		newBackend: newBackend,
		opts:       opts,
	}
	return s
}

func (s *storageBackendSuite) skipTest(name string) bool {
	return s.opts.SkipTests[name]
}

func (s *storageBackendSuite) TestHappyPath() {
	if s.skipTest(TestHappyPath) {
		s.T().Skip("skipping happy path test")
	}
	ctx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
		Rest: authn.AccessTokenClaims{},
	}))

	backend := s.newBackend(ctx)
	server := newServer(s.T(), backend)

	stream, err := backend.WatchWriteEvents(context.Background()) // Using a different context to avoid canceling the stream after the DefaultContextTimeout
	s.Require().NoError(err)
	var rv1, rv2, rv3, rv4, rv5 int64

	s.Run("Add 3 resources", func() {
		rv1, err = writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)
		s.Require().NoError(err)
		s.Require().Greater(rv1, int64(0))

		rv2, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED)
		s.Require().NoError(err)
		s.Require().Greater(rv2, rv1)

		rv3, err = writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED)
		s.Require().NoError(err)
		s.Require().Greater(rv3, rv2)
	})

	s.Run("Update item2", func() {
		rv4, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_MODIFIED)
		s.Require().NoError(err)
		s.Require().Greater(rv4, rv3)
	})

	s.Run("Delete item1", func() {
		rv5, err = writeEvent(ctx, backend, "item1", resource.WatchEvent_DELETED)
		s.Require().NoError(err)
		s.Require().Greater(rv5, rv4)
	})

	s.Run("Read latest item 2", func() {
		resp := backend.ReadResource(ctx, &resource.ReadRequest{Key: resourceKey("item2")})
		s.Require().Nil(resp.Error)
		s.Require().Equal(rv4, resp.ResourceVersion)
		s.Require().Equal("item2 MODIFIED", string(resp.Value))
		s.Require().Equal("folderuid", resp.Folder)
	})

	s.Run("Read early version of item2", func() {
		resp := backend.ReadResource(ctx, &resource.ReadRequest{
			Key:             resourceKey("item2"),
			ResourceVersion: rv3, // item2 was created at rv2 and updated at rv4
		})
		s.Require().Nil(resp.Error)
		s.Require().Equal(rv2, resp.ResourceVersion)
		s.Require().Equal("item2 ADDED", string(resp.Value))
	})

	s.Run("List latest", func() {
		resp, err := server.List(ctx, &resource.ListRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
				},
			},
		})
		s.Require().NoError(err)
		s.Require().Nil(resp.Error)
		s.Require().Len(resp.Items, 2)
		s.Require().Equal("item2 MODIFIED", string(resp.Items[0].Value))
		s.Require().Equal("item3 ADDED", string(resp.Items[1].Value))
		s.Require().GreaterOrEqual(resp.ResourceVersion, rv5) // rv5 is the latest resource version
	})

	s.Run("Watch events", func() {
		event := <-stream
		s.Require().Equal("item1", event.Key.Name)
		s.Require().Equal(rv1, event.ResourceVersion)
		s.Require().Equal(resource.WatchEvent_ADDED, event.Type)
		s.Require().Equal("folderuid", event.Folder)

		event = <-stream
		s.Require().Equal("item2", event.Key.Name)
		s.Require().Equal(rv2, event.ResourceVersion)
		s.Require().Equal(resource.WatchEvent_ADDED, event.Type)
		s.Require().Equal("folderuid", event.Folder)

		event = <-stream
		s.Require().Equal("item3", event.Key.Name)
		s.Require().Equal(rv3, event.ResourceVersion)
		s.Require().Equal(resource.WatchEvent_ADDED, event.Type)

		event = <-stream
		s.Require().Equal("item2", event.Key.Name)
		s.Require().Equal(rv4, event.ResourceVersion)
		s.Require().Equal(resource.WatchEvent_MODIFIED, event.Type)

		event = <-stream
		s.Require().Equal("item1", event.Key.Name)
		s.Require().Equal(rv5, event.ResourceVersion)
		s.Require().Equal(resource.WatchEvent_DELETED, event.Type)
	})
}

func (s *storageBackendSuite) TestGetResourceStats() {
	if s.skipTest(TestGetResourceStats) {
		s.T().Skip("skipping get resource stats test")
	}
	ctx := testutil.NewTestContext(s.T(), time.Now().Add(5*time.Second))

	sortFunc := func(a, b resource.ResourceStats) int {
		if a.Namespace != b.Namespace {
			return strings.Compare(a.Namespace, b.Namespace)
		}
		if a.Group != b.Group {
			return strings.Compare(a.Group, b.Group)
		}
		return strings.Compare(a.Resource, b.Resource)
	}
	backend := s.newBackend(ctx)
	// Create resources across different namespaces/groups
	_, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED,
		WithNamespace("ns1"),
		WithGroup("group"),
		WithResource("resource1"))
	s.Require().NoError(err)

	_, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED,
		WithNamespace("ns1"),
		WithGroup("group"),
		WithResource("resource1"))
	s.Require().NoError(err)

	_, err = writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED,
		WithNamespace("ns1"),
		WithGroup("group"),
		WithResource("resource2"))
	s.Require().NoError(err)

	_, err = writeEvent(ctx, backend, "item4", resource.WatchEvent_ADDED,
		WithNamespace("ns2"),
		WithGroup("group"),
		WithResource("resource1"))
	s.Require().NoError(err)

	_, err = writeEvent(ctx, backend, "item5", resource.WatchEvent_ADDED,
		WithNamespace("ns2"),
		WithGroup("group"),
		WithResource("resource1"))
	s.Require().NoError(err)

	s.Run("Get stats for ns1", func() {
		stats, err := backend.GetResourceStats(ctx, "ns1", 0)
		s.Require().NoError(err)
		s.Require().Len(stats, 2)

		// Sort results for consistent testing
		slices.SortFunc(stats, sortFunc)

		// Check first resource stats
		s.Require().Equal("ns1", stats[0].Namespace)
		s.Require().Equal("group", stats[0].Group)
		s.Require().Equal("resource1", stats[0].Resource)
		s.Require().Equal(int64(2), stats[0].Count)
		s.Require().Greater(stats[0].ResourceVersion, int64(0))

		// Check second resource stats
		s.Require().Equal("ns1", stats[1].Namespace)
		s.Require().Equal("group", stats[1].Group)
		s.Require().Equal("resource2", stats[1].Resource)
		s.Require().Equal(int64(1), stats[1].Count)
		s.Require().Greater(stats[1].ResourceVersion, int64(0))
	})

	s.Run("Get stats for ns2", func() {
		stats, err := backend.GetResourceStats(ctx, "ns2", 0)
		s.Require().NoError(err)
		s.Require().Len(stats, 1)

		s.Require().Equal("ns2", stats[0].Namespace)
		s.Require().Equal("group", stats[0].Group)
		s.Require().Equal("resource1", stats[0].Resource)
		s.Require().Equal(int64(2), stats[0].Count)
		s.Require().Greater(stats[0].ResourceVersion, int64(0))
	})

	s.Run("Get stats with minimum count", func() {
		stats, err := backend.GetResourceStats(ctx, "ns1", 1)
		s.Require().NoError(err)
		s.Require().Len(stats, 1)

		s.Require().Equal("ns1", stats[0].Namespace)
		s.Require().Equal("group", stats[0].Group)
		s.Require().Equal("resource1", stats[0].Resource)
		s.Require().Equal(int64(2), stats[0].Count)
	})

	s.Run("Get stats for non-existent namespace", func() {
		stats, err := backend.GetResourceStats(ctx, "non-existent", 0)
		s.Require().NoError(err)
		s.Require().Empty(stats)
	})
}

func (s *storageBackendSuite) TestWatchWriteEventsFromLastest() {
	if s.skipTest(TestWatchWriteEvents) {
		s.T().Skip("skipping watch write events test")
	}
	ctx := testutil.NewTestContext(s.T(), time.Now().Add(5*time.Second))
	backend := s.newBackend(ctx)
	// Create a few resources before initing the watch
	_, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)
	s.Require().NoError(err)

	// Start the watch
	stream, err := backend.WatchWriteEvents(ctx)
	s.Require().NoError(err)

	// Create one more event
	_, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED)
	s.Require().NoError(err)
	s.Require().Equal("item2", (<-stream).Key.Name)
}

func (s *storageBackendSuite) TestList() {
	if s.skipTest(TestList) {
		s.T().Skip("skipping list test")
	}
	ctx := testutil.NewTestContext(s.T(), time.Now().Add(5*time.Second))
	backend := s.newBackend(ctx)
	server := newServer(s.T(), backend)

	// Create a few resources before starting the watch
	rv1, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)
	s.Require().NoError(err)
	s.Require().Greater(rv1, int64(0))
	rv2, err := writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED)
	s.Require().NoError(err)
	s.Require().Greater(rv2, rv1)
	rv3, err := writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED)
	s.Require().NoError(err)
	s.Require().Greater(rv3, rv2)
	rv4, err := writeEvent(ctx, backend, "item4", resource.WatchEvent_ADDED)
	s.Require().NoError(err)
	s.Require().Greater(rv4, rv3)
	rv5, err := writeEvent(ctx, backend, "item5", resource.WatchEvent_ADDED)
	s.Require().NoError(err)
	s.Require().Greater(rv5, rv4)
	rv6, err := writeEvent(ctx, backend, "item2", resource.WatchEvent_MODIFIED)
	s.Require().NoError(err)
	s.Require().Greater(rv6, rv5)
	rv7, err := writeEvent(ctx, backend, "item3", resource.WatchEvent_DELETED)
	s.Require().NoError(err)
	s.Require().Greater(rv7, rv6)
	rv8, err := writeEvent(ctx, backend, "item6", resource.WatchEvent_ADDED)
	s.Require().NoError(err)
	s.Require().Greater(rv8, rv7)

	s.Run("fetch all latest", func() {
		res, err := server.List(ctx, &resource.ListRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		s.Require().NoError(err)
		s.Require().Nil(res.Error)
		s.Require().Len(res.Items, 5)
		// should be sorted by key ASC
		s.Require().Equal("item1 ADDED", string(res.Items[0].Value))
		s.Require().Equal("item2 MODIFIED", string(res.Items[1].Value))
		s.Require().Equal("item4 ADDED", string(res.Items[2].Value))
		s.Require().Equal("item5 ADDED", string(res.Items[3].Value))
		s.Require().Equal("item6 ADDED", string(res.Items[4].Value))

		s.Require().Empty(res.NextPageToken)
	})

	s.Run("list latest first page ", func() {
		res, err := server.List(ctx, &resource.ListRequest{
			Limit: 3,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		s.Require().NoError(err)
		s.Require().Nil(res.Error)
		s.Require().Len(res.Items, 3)
		continueToken, err := resource.GetContinueToken(res.NextPageToken)
		s.Require().NoError(err)
		s.Require().Equal("item1 ADDED", string(res.Items[0].Value))
		s.Require().Equal("item2 MODIFIED", string(res.Items[1].Value))
		s.Require().Equal("item4 ADDED", string(res.Items[2].Value))
		s.Require().GreaterOrEqual(continueToken.ResourceVersion, rv8)
	})

	s.Run("list at revision", func() {
		res, err := server.List(ctx, &resource.ListRequest{
			ResourceVersion: rv4,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Group:    "group",
					Resource: "resource",
				},
			},
		})
		s.Require().NoError(err)
		s.Require().Nil(res.Error)
		s.Require().Len(res.Items, 4)
		s.Require().Equal("item1 ADDED", string(res.Items[0].Value))
		s.Require().Equal("item2 ADDED", string(res.Items[1].Value))
		s.Require().Equal("item3 ADDED", string(res.Items[2].Value))
		s.Require().Equal("item4 ADDED", string(res.Items[3].Value))
		s.Require().Empty(res.NextPageToken)
	})

	s.Run("fetch first page at revision with limit", func() {
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
		s.Require().NoError(err)
		s.Require().NoError(err)
		s.Require().Nil(res.Error)
		s.Require().Len(res.Items, 3)
		s.Require().Equal("item1 ADDED", string(res.Items[0].Value))
		s.Require().Equal("item2 MODIFIED", string(res.Items[1].Value))
		s.Require().Equal("item4 ADDED", string(res.Items[2].Value))

		continueToken, err := resource.GetContinueToken(res.NextPageToken)
		s.Require().NoError(err)
		s.Require().Equal(rv7, continueToken.ResourceVersion)
	})

	s.Run("fetch second page at revision", func() {
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
		s.Require().NoError(err)
		s.Require().Nil(res.Error)
		s.Require().Len(res.Items, 2)
		s.Require().Equal("item4 ADDED", string(res.Items[0].Value))
		s.Require().Equal("item5 ADDED", string(res.Items[1].Value))

		continueToken, err = resource.GetContinueToken(res.NextPageToken)
		s.Require().NoError(err)
		s.Require().Equal(rv8, continueToken.ResourceVersion)
		s.Require().Equal(int64(4), continueToken.StartOffset)
	})
}

func (s *storageBackendSuite) TestListHistory() {
	if s.skipTest(TestListHistory) {
		s.T().Skip("skipping list history test")
	}
	ctx := testutil.NewTestContext(s.T(), time.Now().Add(5*time.Second))
	backend := s.newBackend(ctx)
	server := newServer(s.T(), backend)

	rv1, _ := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED)
	s.Require().Greater(rv1, int64(0))

	// add 5 events for item1 - should be saved to history
	rvHistory1, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED)
	s.Require().NoError(err)
	s.Require().Greater(rvHistory1, rv1)
	rvHistory2, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED)
	s.Require().NoError(err)
	s.Require().Greater(rvHistory2, rvHistory1)
	rvHistory3, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED)
	s.Require().NoError(err)
	s.Require().Greater(rvHistory3, rvHistory2)
	rvHistory4, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED)
	s.Require().NoError(err)
	s.Require().Greater(rvHistory4, rvHistory3)
	rvHistory5, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED)
	s.Require().NoError(err)
	s.Require().Greater(rvHistory5, rvHistory4)

	s.Run("fetch first history page at revision with limit", func() {
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
		s.Require().NoError(err)
		s.Require().NoError(err)
		s.Require().Nil(res.Error)
		s.Require().Len(res.Items, 3)
		// should be in desc order, so the newest RVs are returned first
		s.Require().Equal("item1 MODIFIED", string(res.Items[0].Value))
		s.Require().Equal(rvHistory5, res.Items[0].ResourceVersion)
		s.Require().Equal("item1 MODIFIED", string(res.Items[1].Value))
		s.Require().Equal(rvHistory4, res.Items[1].ResourceVersion)
		s.Require().Equal("item1 MODIFIED", string(res.Items[2].Value))
		s.Require().Equal(rvHistory3, res.Items[2].ResourceVersion)

		continueToken, err := resource.GetContinueToken(res.NextPageToken)
		s.Require().NoError(err)
		//  should return the furthest back RV as the next page token
		s.Require().Equal(rvHistory3, continueToken.ResourceVersion)
	})

	s.Run("fetch second page of history at revision", func() {
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
		s.Require().NoError(err)
		s.Require().Nil(res.Error)
		s.Require().Len(res.Items, 2)
		s.Require().Equal("item1 MODIFIED", string(res.Items[0].Value))
		s.Require().Equal(rvHistory2, res.Items[0].ResourceVersion)
		s.Require().Equal("item1 MODIFIED", string(res.Items[1].Value))
		s.Require().Equal(rvHistory1, res.Items[1].ResourceVersion)
	})
}

func (s *storageBackendSuite) TestBlobSupport() {
	if s.skipTest(TestBlobSupport) {
		s.T().Skip("skipping blob support test")
	}
	ctx := testutil.NewTestContext(s.T(), time.Now().Add(5*time.Second))
	backend := s.newBackend(ctx)
	server := newServer(s.T(), backend)
	store, ok := backend.(resource.BlobSupport)
	s.Require().True(ok)

	s.Run("put and fetch blob", func() {
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
		s.Require().NoError(err)
		s.Require().Nil(b1.Error)
		s.Require().Equal("c894ae57bd227b8f8c63f38a2ddf458b", b1.Hash)

		b2, err := server.PutBlob(ctx, &resource.PutBlobRequest{
			Resource:    key,
			Method:      resource.PutBlobRequest_GRPC,
			ContentType: "plain/text",
			Value:       []byte("hello 22222"), // the most recent
		})
		s.Require().NoError(err)
		s.Require().Nil(b2.Error)
		s.Require().Equal("b0da48de4ff92e0ad0d836de4d746937", b2.Hash)

		// Check that we can still access both values
		found, err := store.GetResourceBlob(ctx, key, &utils.BlobInfo{UID: b1.Uid}, true)
		s.Require().NoError(err)
		s.Require().Equal([]byte("hello 11111"), found.Value)

		found, err = store.GetResourceBlob(ctx, key, &utils.BlobInfo{UID: b2.Uid}, true)
		s.Require().NoError(err)
		s.Require().Equal([]byte("hello 22222"), found.Value)
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
