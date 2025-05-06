package test

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Test names for the storage backend test suite
const (
	TestHappyPath                 = "happy path"
	TestWatchWriteEvents          = "watch write events from latest"
	TestList                      = "list"
	TestBlobSupport               = "blob support"
	TestGetResourceStats          = "get resource stats"
	TestListHistory               = "list history"
	TestListHistoryErrorReporting = "list history error reporting"
	TestCreateNewResource         = "create new resource"
)

type NewBackendFunc func(ctx context.Context) resource.StorageBackend

// TestOptions configures which tests to run
type TestOptions struct {
	SkipTests map[string]bool // tests to skip
	NSPrefix  string          // namespace prefix for isolation
}

// GenerateRandomNSPrefix creates a random namespace prefix for test isolation
func GenerateRandomNSPrefix() string {
	uid := uuid.New().String()[:10]
	return fmt.Sprintf("test-%s", uid)
}

// RunStorageBackendTest runs the storage backend test suite
func RunStorageBackendTest(t *testing.T, newBackend NewBackendFunc, opts *TestOptions) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	if opts == nil {
		opts = &TestOptions{}
	}

	if opts.NSPrefix == "" {
		opts.NSPrefix = GenerateRandomNSPrefix()
	}

	t.Logf("Running tests with namespace prefix: %s", opts.NSPrefix)

	cases := []struct {
		name string
		fn   func(*testing.T, resource.StorageBackend, string)
	}{
		{TestHappyPath, runTestIntegrationBackendHappyPath},
		{TestWatchWriteEvents, runTestIntegrationBackendWatchWriteEvents},
		{TestList, runTestIntegrationBackendList},
		{TestBlobSupport, runTestIntegrationBlobSupport},
		{TestGetResourceStats, runTestIntegrationBackendGetResourceStats},
		{TestListHistory, runTestIntegrationBackendListHistory},
		{TestListHistoryErrorReporting, runTestIntegrationBackendListHistoryErrorReporting},
		{TestCreateNewResource, runTestIntegrationBackendCreateNewResource},
	}

	for _, tc := range cases {
		if shouldSkip := opts.SkipTests[tc.name]; shouldSkip {
			t.Logf("Skipping test: %s", tc.name)
			continue
		}

		t.Run(tc.name, func(t *testing.T) {
			tc.fn(t, newBackend(context.Background()), opts.NSPrefix)
		})
	}
}

func runTestIntegrationBackendHappyPath(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
	ctx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
		Rest: authn.AccessTokenClaims{},
	}))

	server := newServer(t, backend)
	ns := nsPrefix + "-ns1"
	stream, err := backend.WatchWriteEvents(context.Background()) // Using a different context to avoid canceling the stream after the DefaultContextTimeout
	require.NoError(t, err)
	var rv1, rv2, rv3, rv4, rv5 int64

	t.Run("Add 3 resources", func(t *testing.T) {
		rv1, err = writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED, WithNamespace(ns))
		require.NoError(t, err)
		require.Greater(t, rv1, int64(0))

		rv2, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED, WithNamespace(ns))
		require.NoError(t, err)
		require.Greater(t, rv2, rv1)

		rv3, err = writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED, WithNamespace(ns))
		require.NoError(t, err)
		require.Greater(t, rv3, rv2)
	})

	t.Run("Update item2", func(t *testing.T) {
		rv4, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_MODIFIED, WithNamespace(ns))
		require.NoError(t, err)
		require.Greater(t, rv4, rv3)
	})

	t.Run("Delete item1", func(t *testing.T) {
		rv5, err = writeEvent(ctx, backend, "item1", resource.WatchEvent_DELETED, WithNamespace(ns))
		require.NoError(t, err)
		require.Greater(t, rv5, rv4)
	})

	t.Run("Read latest item 2", func(t *testing.T) {
		resp := backend.ReadResource(ctx, &resource.ReadRequest{
			Key: &resource.ResourceKey{
				Name:      "item2",
				Namespace: ns,
				Group:     "group",
				Resource:  "resource",
			},
		})
		require.Nil(t, resp.Error)
		require.Equal(t, rv4, resp.ResourceVersion)
		require.Equal(t, "item2 MODIFIED", string(resp.Value))
		require.Equal(t, "folderuid", resp.Folder)
	})

	t.Run("Read early version of item2", func(t *testing.T) {
		resp := backend.ReadResource(ctx, &resource.ReadRequest{
			Key: &resource.ResourceKey{
				Name:      "item2",
				Namespace: ns,
				Group:     "group",
				Resource:  "resource",
			},
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
					Namespace: ns,
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

func runTestIntegrationBackendGetResourceStats(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
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
		WithNamespace(nsPrefix+"-ns1"),
		WithGroup("group"),
		WithResource("resource1"))
	require.NoError(t, err)

	_, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED,
		WithNamespace(nsPrefix+"-ns1"),
		WithGroup("group"),
		WithResource("resource1"))
	require.NoError(t, err)

	_, err = writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED,
		WithNamespace(nsPrefix+"-ns1"),
		WithGroup("group"),
		WithResource("resource2"))
	require.NoError(t, err)

	_, err = writeEvent(ctx, backend, "item4", resource.WatchEvent_ADDED,
		WithNamespace(nsPrefix+"-ns2"),
		WithGroup("group"),
		WithResource("resource1"))
	require.NoError(t, err)

	_, err = writeEvent(ctx, backend, "item5", resource.WatchEvent_ADDED,
		WithNamespace(nsPrefix+"-ns2"),
		WithGroup("group"),
		WithResource("resource1"))
	require.NoError(t, err)

	t.Run("Get stats for ns1", func(t *testing.T) {
		stats, err := backend.GetResourceStats(ctx, nsPrefix+"-ns1", 0)
		require.NoError(t, err)
		require.Len(t, stats, 2)

		// Sort results for consistent testing
		slices.SortFunc(stats, sortFunc)

		// Check first resource stats
		require.Equal(t, nsPrefix+"-ns1", stats[0].Namespace)
		require.Equal(t, "group", stats[0].Group)
		require.Equal(t, "resource1", stats[0].Resource)
		require.Equal(t, int64(2), stats[0].Count)
		require.Greater(t, stats[0].ResourceVersion, int64(0))

		// Check second resource stats
		require.Equal(t, nsPrefix+"-ns1", stats[1].Namespace)
		require.Equal(t, "group", stats[1].Group)
		require.Equal(t, "resource2", stats[1].Resource)
		require.Equal(t, int64(1), stats[1].Count)
		require.Greater(t, stats[1].ResourceVersion, int64(0))
	})

	t.Run("Get stats for ns2", func(t *testing.T) {
		stats, err := backend.GetResourceStats(ctx, nsPrefix+"-ns2", 0)
		require.NoError(t, err)
		require.Len(t, stats, 1)

		require.Equal(t, nsPrefix+"-ns2", stats[0].Namespace)
		require.Equal(t, "group", stats[0].Group)
		require.Equal(t, "resource1", stats[0].Resource)
		require.Equal(t, int64(2), stats[0].Count)
		require.Greater(t, stats[0].ResourceVersion, int64(0))
	})

	t.Run("Get stats with minimum count", func(t *testing.T) {
		stats, err := backend.GetResourceStats(ctx, nsPrefix+"-ns1", 1)
		require.NoError(t, err)
		require.Len(t, stats, 1)

		require.Equal(t, nsPrefix+"-ns1", stats[0].Namespace)
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

func runTestIntegrationBackendWatchWriteEvents(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))

	// Create a few resources before initing the watch
	_, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED, WithNamespace(nsPrefix+"-ns1"))
	require.NoError(t, err)

	// Start the watch
	stream, err := backend.WatchWriteEvents(ctx)
	require.NoError(t, err)

	// Create one more event
	_, err = writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED, WithNamespace(nsPrefix+"-ns1"))
	require.NoError(t, err)
	require.Equal(t, "item2", (<-stream).Key.Name)

	// Should close the stream
	ctx.Cancel()

	_, ok := <-stream
	require.False(t, ok)
}

func runTestIntegrationBackendList(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	server := newServer(t, backend)
	ns := nsPrefix + "-ns1"
	// Create a few resources before starting the watch
	rv1, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rv1, int64(0))
	rv2, err := writeEvent(ctx, backend, "item2", resource.WatchEvent_ADDED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rv2, rv1)
	rv3, err := writeEvent(ctx, backend, "item3", resource.WatchEvent_ADDED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rv3, rv2)
	rv4, err := writeEvent(ctx, backend, "item4", resource.WatchEvent_ADDED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rv4, rv3)
	rv5, err := writeEvent(ctx, backend, "item5", resource.WatchEvent_ADDED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rv5, rv4)
	rv6, err := writeEvent(ctx, backend, "item2", resource.WatchEvent_MODIFIED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rv6, rv5)
	rv7, err := writeEvent(ctx, backend, "item3", resource.WatchEvent_DELETED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rv7, rv6)
	rv8, err := writeEvent(ctx, backend, "item6", resource.WatchEvent_ADDED, WithNamespace(ns))
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
			SortAscending:   false,
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

func runTestIntegrationBackendListHistory(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	server := newServer(t, backend)
	ns := nsPrefix + "-ns1"
	rv1, _ := writeEvent(ctx, backend, "item1", resource.WatchEvent_ADDED, WithNamespace(ns))
	require.Greater(t, rv1, int64(0))

	// add 5 events for item1 - should be saved to history
	rvHistory1, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rvHistory1, rv1)
	rvHistory2, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rvHistory2, rvHistory1)
	rvHistory3, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rvHistory3, rvHistory2)
	rvHistory4, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rvHistory4, rvHistory3)
	rvHistory5, err := writeEvent(ctx, backend, "item1", resource.WatchEvent_MODIFIED, WithNamespace(ns))
	require.NoError(t, err)
	require.Greater(t, rvHistory5, rvHistory4)

	t.Run("fetch history with different version matching", func(t *testing.T) {
		baseKey := &resource.ResourceKey{
			Namespace: ns,
			Group:     "group",
			Resource:  "resource",
			Name:      "item1",
		}

		tests := []struct {
			name               string
			request            *resource.ListRequest
			expectedVersions   []int64
			expectedValues     []string
			minExpectedHeadRV  int64
			expectedContinueRV int64
			expectedSortAsc    bool
		}{
			{
				name: "NotOlderThan with rv1 (ASC order)",
				request: &resource.ListRequest{
					Limit:           3,
					Source:          resource.ListRequest_HISTORY,
					ResourceVersion: rv1,
					VersionMatchV2:  resource.ResourceVersionMatchV2_NotOlderThan,
					Options: &resource.ListOptions{
						Key: baseKey,
					},
				},
				expectedVersions:   []int64{rv1, rvHistory1, rvHistory2},
				expectedValues:     []string{"item1 ADDED", "item1 MODIFIED", "item1 MODIFIED"},
				minExpectedHeadRV:  rvHistory2,
				expectedContinueRV: rvHistory2,
				expectedSortAsc:    true,
			},
			{
				name: "NotOlderThan with rv=0 (ASC order)",
				request: &resource.ListRequest{
					Limit:           3,
					Source:          resource.ListRequest_HISTORY,
					ResourceVersion: 0,
					VersionMatchV2:  resource.ResourceVersionMatchV2_NotOlderThan,
					Options: &resource.ListOptions{
						Key: baseKey,
					},
				},
				expectedVersions:   []int64{rv1, rvHistory1, rvHistory2},
				expectedValues:     []string{"item1 ADDED", "item1 MODIFIED", "item1 MODIFIED"},
				minExpectedHeadRV:  rvHistory2,
				expectedContinueRV: rvHistory2,
				expectedSortAsc:    true,
			},
			{
				name: "ResourceVersionMatch_Unset (DESC order)",
				request: &resource.ListRequest{
					Limit:  3,
					Source: resource.ListRequest_HISTORY,
					Options: &resource.ListOptions{
						Key: baseKey,
					},
				},
				expectedVersions:   []int64{rvHistory5, rvHistory4, rvHistory3},
				expectedValues:     []string{"item1 MODIFIED", "item1 MODIFIED", "item1 MODIFIED"},
				minExpectedHeadRV:  rvHistory5,
				expectedContinueRV: rvHistory3,
				expectedSortAsc:    false,
			},
		}

		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				res, err := server.List(ctx, tc.request)
				require.NoError(t, err)
				require.Nil(t, res.Error)
				require.Len(t, res.Items, 3)

				// Check versions and values match expectations
				for i := 0; i < 3; i++ {
					require.Equal(t, tc.expectedVersions[i], res.Items[i].ResourceVersion)
					require.Equal(t, tc.expectedValues[i], string(res.Items[i].Value))
				}

				// Check resource version in response
				require.GreaterOrEqual(t, res.ResourceVersion, tc.minExpectedHeadRV)

				// Check continue token
				continueToken, err := resource.GetContinueToken(res.NextPageToken)
				require.NoError(t, err)
				require.Equal(t, tc.expectedContinueRV, continueToken.ResourceVersion)
				require.Equal(t, tc.expectedSortAsc, continueToken.SortAscending)
			})
		}

		// Test pagination for NotOlderThan (second page)
		t.Run("second page with NotOlderThan", func(t *testing.T) {
			// Get first page
			firstRequest := &resource.ListRequest{
				Limit:           3,
				Source:          resource.ListRequest_HISTORY,
				ResourceVersion: rv1,
				VersionMatchV2:  resource.ResourceVersionMatchV2_NotOlderThan,
				Options:         &resource.ListOptions{Key: baseKey},
			}
			firstPageRes, err := server.List(ctx, firstRequest)
			require.NoError(t, err)

			// Get continue token for second page
			continueToken, err := resource.GetContinueToken(firstPageRes.NextPageToken)
			require.NoError(t, err)

			// Get second page
			secondPageRes, err := server.List(ctx, &resource.ListRequest{
				Limit:           3,
				Source:          resource.ListRequest_HISTORY,
				ResourceVersion: rv1,
				VersionMatchV2:  resource.ResourceVersionMatchV2_NotOlderThan,
				NextPageToken:   continueToken.String(),
				Options:         &resource.ListOptions{Key: baseKey},
			})
			require.NoError(t, err)
			require.Nil(t, secondPageRes.Error)
			require.Len(t, secondPageRes.Items, 3)

			// Second page should continue in ascending order
			expectedRVs := []int64{rvHistory3, rvHistory4, rvHistory5}
			for i, expectedRV := range expectedRVs {
				require.Equal(t, expectedRV, secondPageRes.Items[i].ResourceVersion)
				require.Equal(t, "item1 MODIFIED", string(secondPageRes.Items[i].Value))
			}
		})
	})

	t.Run("fetch second page of history at revision", func(t *testing.T) {
		continueToken := &resource.ContinueToken{
			ResourceVersion: rvHistory3,
			StartOffset:     2,
			SortAscending:   false,
		}
		res, err := server.List(ctx, &resource.ListRequest{
			NextPageToken: continueToken.String(),
			Limit:         2,
			Source:        resource.ListRequest_HISTORY,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: ns,
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

	t.Run("paginated history with NotOlderThan returns items in ascending order", func(t *testing.T) {
		// Create 10 versions of a resource to test pagination
		ns2 := nsPrefix + "-ns2"
		resourceKey := &resource.ResourceKey{
			Namespace: ns2,
			Group:     "group",
			Resource:  "resource",
			Name:      "paged-item",
		}

		var resourceVersions []int64

		// First create the initial resource
		initialRV, err := writeEvent(ctx, backend, "paged-item", resource.WatchEvent_ADDED, WithNamespace(ns2))
		require.NoError(t, err)
		resourceVersions = append(resourceVersions, initialRV)

		// Create 9 more versions with modifications
		for i := 0; i < 9; i++ {
			rv, err := writeEvent(ctx, backend, "paged-item", resource.WatchEvent_MODIFIED, WithNamespace(ns2))
			require.NoError(t, err)
			resourceVersions = append(resourceVersions, rv)
		}

		// Now we should have 10 versions total (1 ADDED + 9 MODIFIED)
		require.Len(t, resourceVersions, 10)

		// Test pagination with limit of 3 and NotOlderThan, starting from the beginning
		pages := []struct {
			pageNumber int
			pageSize   int
			startToken string
		}{
			{pageNumber: 1, pageSize: 3, startToken: ""},
			{pageNumber: 2, pageSize: 3, startToken: ""}, // Will be set in the test
			{pageNumber: 3, pageSize: 3, startToken: ""}, // Will be set in the test
			{pageNumber: 4, pageSize: 1, startToken: ""}, // Will be set in the test - last page with remaining item
		}

		var allItems []*resource.ResourceWrapper

		// Request first page with NotOlderThan and ResourceVersion=0 (should start from oldest)
		for i, page := range pages {
			req := &resource.ListRequest{
				Limit:           int64(page.pageSize),
				Source:          resource.ListRequest_HISTORY,
				ResourceVersion: 0,
				VersionMatchV2:  resource.ResourceVersionMatchV2_NotOlderThan,
				Options: &resource.ListOptions{
					Key: resourceKey,
				},
			}

			if i > 0 {
				// For subsequent pages, use the continue token from the previous page
				req.NextPageToken = pages[i].startToken
			}

			res, err := server.List(ctx, req)
			require.NoError(t, err)
			require.Nil(t, res.Error)

			// First 3 pages should have exactly pageSize items
			if i < 3 {
				require.Len(t, res.Items, page.pageSize, "Page %d should have %d items", i+1, page.pageSize)
			} else {
				// Last page should have 1 item (10 items total with 3+3+3+1 distribution)
				require.Len(t, res.Items, 1, "Last page should have 1 item")
			}

			// Save continue token for next page if not the last page
			if i < len(pages)-1 {
				pages[i+1].startToken = res.NextPageToken
				require.NotEmpty(t, res.NextPageToken, "Should have continue token for page %d", i+1)
			} else {
				// Last page should not have a continue token
				require.Empty(t, res.NextPageToken, "Last page should not have continue token")
			}

			// Add items to our collection
			allItems = append(allItems, res.Items...)

			// Verify all items in current page are in ascending order
			for j := 1; j < len(res.Items); j++ {
				require.Less(t, res.Items[j-1].ResourceVersion, res.Items[j].ResourceVersion,
					"Items within page %d should be in ascending order", i+1)
			}

			// For pages after the first, verify first item of current page is greater than last item of previous page
			if i > 0 && len(allItems) > page.pageSize {
				prevPageLastIdx := len(allItems) - len(res.Items) - 1
				currentPageFirstIdx := len(allItems) - len(res.Items)
				require.Greater(t, allItems[currentPageFirstIdx].ResourceVersion, allItems[prevPageLastIdx].ResourceVersion,
					"First item of page %d should have higher RV than last item of page %d", i+1, i)
			}
		}

		// Verify we got all 10 items
		require.Len(t, allItems, 10, "Should have retrieved all 10 items")

		// Verify all items are in ascending order of resource version
		for i := 1; i < len(allItems); i++ {
			require.Less(t, allItems[i-1].ResourceVersion, allItems[i].ResourceVersion,
				"All items should be in ascending order of resource version")
		}

		// Verify the first item is the initial ADDED event
		require.Equal(t, initialRV, allItems[0].ResourceVersion, "First item should be the initial ADDED event")
		require.Equal(t, "paged-item ADDED", string(allItems[0].Value))

		// Verify all other items are MODIFIED events and correspond to our recorded resource versions
		for i := 1; i < len(allItems); i++ {
			require.Equal(t, "paged-item MODIFIED", string(allItems[i].Value))
			require.Equal(t, resourceVersions[i], allItems[i].ResourceVersion)
		}
	})

	t.Run("fetch history with deleted item", func(t *testing.T) {
		// Create a resource and delete it
		rv, err := writeEvent(ctx, backend, "deleted-item", resource.WatchEvent_ADDED, WithNamespace(ns))
		require.NoError(t, err)
		rvDeleted, err := writeEvent(ctx, backend, "deleted-item", resource.WatchEvent_DELETED, WithNamespace(ns))
		require.NoError(t, err)
		require.Greater(t, rvDeleted, rv)

		// Fetch history for the deleted item
		res, err := server.List(ctx, &resource.ListRequest{
			Source: resource.ListRequest_HISTORY,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: ns,
					Group:     "group",
					Resource:  "resource",
					Name:      "deleted-item",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 0)
	})

	t.Run("fetch history with recreated item", func(t *testing.T) {
		// Create a resource and delete it
		rv, err := writeEvent(ctx, backend, "deleted-item", resource.WatchEvent_ADDED, WithNamespace(ns))
		require.NoError(t, err)
		rvDeleted, err := writeEvent(ctx, backend, "deleted-item", resource.WatchEvent_DELETED, WithNamespace(ns))
		require.NoError(t, err)
		require.Greater(t, rvDeleted, rv)

		// Create a few more versions after deletion
		rv1, err := writeEvent(ctx, backend, "deleted-item", resource.WatchEvent_ADDED, WithNamespace(ns))
		require.NoError(t, err)
		require.Greater(t, rv1, rvDeleted)
		rv2, err := writeEvent(ctx, backend, "deleted-item", resource.WatchEvent_MODIFIED, WithNamespace(ns))
		require.NoError(t, err)
		require.Greater(t, rv2, rv1)

		// Fetch history for the deleted item
		res, err := server.List(ctx, &resource.ListRequest{
			Source: resource.ListRequest_HISTORY,
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: ns,
					Group:     "group",
					Resource:  "resource",
					Name:      "deleted-item",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, res.Error)
		require.Len(t, res.Items, 2)
		require.Equal(t, "deleted-item MODIFIED", string(res.Items[0].Value))
		require.Equal(t, rv2, res.Items[0].ResourceVersion)
		require.Equal(t, "deleted-item ADDED", string(res.Items[1].Value))
		require.Equal(t, rv1, res.Items[1].ResourceVersion)
	})
}

func runTestIntegrationBackendListHistoryErrorReporting(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
	server := newServer(t, backend)

	ns := nsPrefix + "-short"
	const (
		name         = "it1"
		group        = "group"
		resourceName = "resource"
	)

	start := time.Now()
	origRv, _ := writeEvent(ctx, backend, name, resource.WatchEvent_ADDED, WithNamespace(ns), WithGroup(group), WithResource(resourceName))
	require.Greater(t, origRv, int64(0))

	const events = 500
	prevRv := origRv
	for i := 0; i < events; i++ {
		rv, err := writeEvent(ctx, backend, name, resource.WatchEvent_MODIFIED, WithNamespace(ns), WithGroup(group), WithResource(resourceName))
		require.NoError(t, err)
		require.Greater(t, rv, prevRv)
		prevRv = rv
	}
	t.Log("added events in ", time.Since(start))

	req := &resource.ListRequest{
		Limit:           2 * events,
		Source:          resource.ListRequest_HISTORY,
		ResourceVersion: origRv,
		VersionMatchV2:  resource.ResourceVersionMatchV2_NotOlderThan,
		Options: &resource.ListOptions{
			Key: &resource.ResourceKey{
				Namespace: ns,
				Group:     group,
				Resource:  resourceName,
				Name:      name,
			},
		},
	}

	shortContext, cancel := context.WithTimeout(ctx, 1*time.Microsecond)
	defer cancel()

	res, err := server.List(shortContext, req)
	// We expect context deadline error, but it may be reported as a res.Error object.
	t.Log("list error:", err)
	if res != nil {
		t.Log("iterator error:", res.Error)
		t.Log("numItems:", len(res.Items))
	}
	require.True(t, err != nil || (res != nil && res.Error != nil))
}

func runTestIntegrationBlobSupport(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	server := newServer(t, backend)
	store, ok := backend.(resource.BlobSupport)
	require.True(t, ok)
	ns := nsPrefix + "-ns1"

	t.Run("put and fetch blob", func(t *testing.T) {
		key := &resource.ResourceKey{
			Namespace: ns,
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

func runTestIntegrationBackendCreateNewResource(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
	ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "testuser",
		},
		Rest: authn.AccessTokenClaims{},
	}))

	server := newServer(t, backend)
	ns := nsPrefix + "-create-resource"
	ctx = request.WithNamespace(ctx, ns)

	request := &resource.CreateRequest{
		Key: &resource.ResourceKey{
			Namespace: "default",
			Group:     "test.grafana",
			Resource:  "Test",
			Name:      "test",
		},
		Value: []byte(`{"apiVersion":"test.grafana/v0alpha1","kind":"Test","metadata":{"name":"test","namespace":"default"}}`),
	}

	response, err := server.Create(ctx, request)
	require.NoError(t, err, "create resource")
	require.Nil(t, response.Error, "create resource response.Error")

	t.Run("gracefully handles resource already exists error", func(t *testing.T) {
		response, err := server.Create(ctx, request)
		require.NoError(t, err, "create resource")
		require.NotNil(t, response.GetError(), "create resource response.Error")
		assert.Equal(t, int32(http.StatusConflict), response.GetError().GetCode(), "create resource response.Error.Code")
		assert.Equal(t, string(metav1.StatusReasonAlreadyExists), response.GetError().GetReason(), "create resource response.Error.Reason")
		t.Logf("Error: %v", response.GetError()) // only prints on failure, so this is fine
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

func newServer(t *testing.T, b resource.StorageBackend) resource.ResourceServer {
	t.Helper()

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: b,
	})
	require.NoError(t, err)
	require.NotNil(t, server)

	return server
}
