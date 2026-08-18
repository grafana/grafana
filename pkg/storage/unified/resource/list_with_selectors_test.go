package resource

import (
	"context"
	"iter"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

func TestUseSelectorSearch(t *testing.T) {
	tests := map[string]struct {
		disableSearch   bool
		req             *resourcepb.ListRequest
		expectedAllowed bool
	}{
		"false when no search client": {
			disableSearch: true,
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: false,
		},
		"false when source is not store": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_HISTORY,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: false,
		},
		"false when no field or label selectors": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx"},
				},
			},
			expectedAllowed: false,
		},
		"false when the list is cross-namespace": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Group: "advisor.grafana.app"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
					Labels: []*resourcepb.Requirement{{Key: "has-rules", Operator: "=", Values: []string{"true"}}},
				},
			},
			expectedAllowed: false,
		},
		"true when store, labels only, and search client": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app"},
					Labels: []*resourcepb.Requirement{{Key: "alerting.grafana.app/has-rules", Operator: "=", Values: []string{"true"}}},
				},
			},
			expectedAllowed: true,
		},
		"false when version match exact": {
			req: &resourcepb.ListRequest{
				Source:         resourcepb.ListRequest_STORE,
				VersionMatchV2: resourcepb.ResourceVersionMatchV2_Exact,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: false,
		},
		"false when version match not older than": {
			req: &resourcepb.ListRequest{
				Source:         resourcepb.ListRequest_STORE,
				VersionMatchV2: resourcepb.ResourceVersionMatchV2_NotOlderThan,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: false,
		},
		"true when store, fields, and search client": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: true,
		},
		"false when group has no kinds in manifest": {
			req: &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "nsx", Group: "provisioning.grafana.app"},
					Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
				},
			},
			expectedAllowed: false,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			s := &server{}
			if !tc.disableSearch {
				s.searchClient = &stubSearchClient{}
			}

			require.Equal(t, tc.expectedAllowed, s.useSelectorSearch(tc.req))
		})
	}
}

func TestFilterSelectors(t *testing.T) {
	tests := map[string]struct {
		req           *resourcepb.ListRequest
		wantFieldKeys []string
	}{
		"removes metadata.namespace and keep valid field": {
			req: &resourcepb.ListRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{
						{Key: "metadata.namespace", Operator: "=", Values: []string{"ns"}},
						{Key: "spec.foo", Operator: "="},
					},
				},
			},
			wantFieldKeys: []string{"spec.foo"},
		},
		"removes multiple unsupported fields": {
			req: &resourcepb.ListRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "nsx"},
					Fields: []*resourcepb.Requirement{
						{Key: "metadata.namespace", Operator: "=", Values: []string{"ns", "other"}},
						{Key: "spec.foo", Operator: "!="},
					},
				},
			},
			wantFieldKeys: []string{},
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			out := filterSelectors(tc.req)

			gotKeys := make([]string, 0, len(out.Options.Fields))
			for _, f := range out.Options.Fields {
				gotKeys = append(gotKeys, f.Key)
			}
			require.Equal(t, tc.wantFieldKeys, gotKeys)
		})
	}
}

func TestFilterSelectors_Labels(t *testing.T) {
	req := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{Namespace: "nsx"},
			Labels: []*resourcepb.Requirement{
				{Key: "keep-equals", Operator: "="},
				{Key: "keep-double-equals", Operator: "=="},
				{Key: "keep-in", Operator: "in"},
				{Key: "keep-notin", Operator: "notin"},
				{Key: "drop-not-equals", Operator: "!="},
				{Key: "drop-exists", Operator: "exists"},
			},
		},
	}

	got := make([]string, 0, len(req.Options.Labels))
	for _, l := range filterSelectors(req).Options.Labels {
		got = append(got, l.Key)
	}
	require.Equal(t, []string{"keep-equals", "keep-double-equals", "keep-in", "keep-notin"}, got)
}

func TestTokenFromOtherListPath(t *testing.T) {
	searchToken := &ContinueToken{SearchAfter: []string{"s1"}, ResourceVersion: 100}
	scanToken := &ContinueToken{Name: "a", ResourceVersion: 100}

	require.False(t, tokenFromOtherListPath(searchToken, true))
	require.True(t, tokenFromOtherListPath(searchToken, false))
	require.True(t, tokenFromOtherListPath(scanToken, true))
	require.False(t, tokenFromOtherListPath(scanToken, false))
}

func TestListWithSelectors(t *testing.T) {
	searchServerRv := int64(100)

	t.Run("label selectors reach search unprefixed, fields are prefixed", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{resp: &resourcepb.ResourceSearchResponse{ResourceVersion: searchServerRv}}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo", Operator: "=", Values: []string{"bar"}}},
				Labels: []*resourcepb.Requirement{{Key: "alerting.grafana.app/has-rules", Operator: "=", Values: []string{"true"}}},
			},
		}

		_, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, searchClient.last)
		// The search backend prefixes label keys itself, so they are passed through.
		require.Equal(t, "alerting.grafana.app/has-rules", searchClient.last.Options.Labels[0].Key)
		require.Equal(t, SEARCH_SELECTABLE_FIELDS_PREFIX+"spec.foo", searchClient.last.Options.Fields[0].Key)
	})

	t.Run("rejects a continue token from the store path", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		s := createTestServer(&stubSearchClient{resp: &resourcepb.ResourceSearchResponse{}}, 1024)
		req := &resourcepb.ListRequest{
			Limit:         10,
			NextPageToken: ContinueToken{Name: "a", ResourceVersion: searchServerRv}.String(),
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Labels: []*resourcepb.Requirement{{Key: "has-rules", Operator: "=", Values: []string{"true"}}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp.Error)
		require.Equal(t, int32(http.StatusBadRequest), resp.Error.Code)
	})

	t.Run("a page left empty by authorization returns no items and no token", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"}, ResourceVersion: 1, SortFields: []string{"s1"}},
						{Key: &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"}, ResourceVersion: 2, SortFields: []string{"s2"}},
					},
				},
			},
		}
		s := createTestServer(searchClient, 1024)
		s.backend = &fakeBackend{forbidden: map[string]struct{}{"a": {}, "b": {}}}
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Labels: []*resourcepb.Requirement{{Key: "has-rules", Operator: "=", Values: []string{"true"}}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.Empty(t, resp.Items)
		require.Empty(t, resp.NextPageToken)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
	})

	t.Run("a single page result will have index rv and no next page token", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"},
							ResourceVersion: 1,
							SortFields:      []string{"s1"},
						},
					},
				},
			},
		}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Items, 1)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
		require.Empty(t, resp.NextPageToken)
	})

	t.Run("skips results when Read returns forbidden", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"},
							ResourceVersion: 1,
							SortFields:      []string{"s1"},
						},
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"},
							ResourceVersion: 2,
							SortFields:      []string{"s2"},
						},
					},
				},
			},
		}
		s := &server{
			searchClient:     searchClient,
			backend:          &fakeBackend{forbidden: map[string]struct{}{"a": {}}},
			access:           claims.FixedAccessClient(true),
			queue:            scheduler.NewNoopQueue(),
			queueConfig:      QueueConfig{Timeout: time.Second, MinBackoff: time.Millisecond, MaxBackoff: time.Millisecond, MaxRetries: 1},
			maxPageSizeBytes: 1024,
			log:              log.NewNopLogger(),
		}
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Items, 1)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
	})

	t.Run("first page of paginated result will have next page token set and correct number of results", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"},
							ResourceVersion: 1,
							SortFields:      []string{"s1"},
						},
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"},
							ResourceVersion: 2,
							SortFields:      []string{"s2"},
						},
					},
				},
			},
		}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit: 1,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
		require.Len(t, resp.Items, 1)
		require.NotEmpty(t, resp.NextPageToken)
		token, err := GetContinueToken(resp.NextPageToken)
		require.NoError(t, err)
		require.NotNil(t, token)
		require.Equal(t, []string{"s1"}, token.SearchAfter)
		require.Equal(t, searchServerRv, token.ResourceVersion)
	})

	t.Run("can handle pagination when list request has a token present", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		continueToken, err := NewSearchContinueToken([]string{"s1"}, searchServerRv)
		require.NoError(t, err)

		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"},
							ResourceVersion: 2,
							SortFields:      []string{"s2"},
						},
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "c"},
							ResourceVersion: 2,
							SortFields:      []string{"s3"},
						},
					},
				},
			},
		}
		s := createTestServer(searchClient, 1024)
		req := &resourcepb.ListRequest{
			Limit:         1,
			NextPageToken: continueToken,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
		require.Len(t, resp.Items, 1)
		require.NotEmpty(t, resp.NextPageToken)

		parsedToken, err := GetContinueToken(continueToken)
		require.NoError(t, err)
		require.NotNil(t, searchClient.last)
		require.Equal(t, parsedToken.SearchAfter, searchClient.last.SearchAfter)
		require.Equal(t, parsedToken.SearchBefore, searchClient.last.SearchBefore)

		token, err := GetContinueToken(resp.NextPageToken)
		require.NoError(t, err)
		require.NotNil(t, token)
		require.Equal(t, []string{"s2"}, token.SearchAfter)
		require.Equal(t, searchServerRv, token.ResourceVersion)
	})

	t.Run("will paginate when max page size bytes is reached", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "a"},
							ResourceVersion: 1,
							SortFields:      []string{"s1"},
						},
						{
							Key:             &resourcepb.ResourceKey{Namespace: "nsx", Group: "grp", Resource: "res", Name: "b"},
							ResourceVersion: 2,
							SortFields:      []string{"s2"},
						},
					},
				},
			},
		}
		s := createTestServer(searchClient, 5)
		req := &resourcepb.ListRequest{
			Limit: 10,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "nsx"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithSelectors(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Items, 1)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
		require.NotEmpty(t, resp.NextPageToken)

		parsedToken, err := GetContinueToken(resp.NextPageToken)
		require.NoError(t, err)
		require.Equal(t, []string{"s1"}, parsedToken.SearchAfter)
		require.Equal(t, searchServerRv, parsedToken.ResourceVersion)
	})
}

func createTestServer(searchClient resourcepb.ResourceIndexClient, maxPageSizeBytes int) *server {
	return &server{
		searchClient:     searchClient,
		backend:          &fakeBackend{},
		access:           claims.FixedAccessClient(true),
		queue:            scheduler.NewNoopQueue(),
		queueConfig:      QueueConfig{Timeout: time.Second, MinBackoff: time.Millisecond, MaxBackoff: time.Millisecond, MaxRetries: 1},
		maxPageSizeBytes: maxPageSizeBytes,
		log:              log.NewNopLogger(),
	}
}

type stubSearchClient struct {
	resp *resourcepb.ResourceSearchResponse
	err  error
	last *resourcepb.ResourceSearchRequest
}

func (s *stubSearchClient) Search(_ context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	s.last = req
	return s.resp, s.err
}

func (*stubSearchClient) GetStats(_ context.Context, _ *resourcepb.ResourceStatsRequest, _ ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return nil, nil
}

func (*stubSearchClient) RebuildIndexes(_ context.Context, _ *resourcepb.RebuildIndexesRequest, _ ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, nil
}

func (*stubSearchClient) VectorSearch(_ context.Context, _ *resourcepb.VectorSearchRequest, _ ...grpc.CallOption) (*resourcepb.VectorSearchResponse, error) {
	return nil, nil
}

func (*stubSearchClient) HybridSearch(_ context.Context, _ *resourcepb.HybridSearchRequest, _ ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	return nil, nil
}

type fakeBackend struct {
	UnimplementedStorageBackend
	forbidden map[string]struct{}
}

func (*fakeBackend) WriteEvent(context.Context, WriteEvent) (int64, error) { return 0, nil }
func (b *fakeBackend) ReadResource(_ context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	if b != nil && b.forbidden != nil {
		if _, ok := b.forbidden[req.Key.Name]; ok {
			return &BackendReadResponse{
				Key:   req.Key,
				Error: &resourcepb.ErrorResult{Code: http.StatusForbidden},
			}
		}
	}
	return &BackendReadResponse{
		Key:             req.Key,
		ResourceVersion: req.ResourceVersion,
		Value:           []byte("value"),
	}
}
func (*fakeBackend) ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, nil
}
func (*fakeBackend) ListHistory(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, nil
}
func (*fakeBackend) ListModifiedSince(context.Context, NamespacedResource, int64, *time.Time) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 0, func(func(*ModifiedResource, error) bool) {}
}
func (*fakeBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	ch := make(chan *WrittenEvent)
	context.AfterFunc(ctx, func() { close(ch) })
	return ch, nil
}
func (*fakeBackend) GetResourceStats(context.Context, NamespacedResource, int) ([]ResourceStats, error) {
	return nil, nil
}

func (*fakeBackend) GetResourceLastImportTimes(context.Context) iter.Seq2[ResourceLastImportTime, error] {
	return func(func(ResourceLastImportTime, error) bool) {}
}
