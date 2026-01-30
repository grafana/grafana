package resource

import (
	"context"
	"iter"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

func TestUseFieldSelectorSearch(t *testing.T) {
	tests := []struct {
		name            string
		withSearch      bool
		source          resourcepb.ListRequest_Source
		withFields      bool
		versionMatchV2  resourcepb.ResourceVersionMatchV2
		expectedAllowed bool
	}{
		{
			name:            "false when no search client",
			withSearch:      false,
			source:          resourcepb.ListRequest_STORE,
			withFields:      true,
			expectedAllowed: false,
		},
		{
			name:            "false when source is not store",
			withSearch:      true,
			source:          resourcepb.ListRequest_HISTORY,
			withFields:      true,
			expectedAllowed: false,
		},
		{
			name:            "false when no field selectors",
			withSearch:      true,
			source:          resourcepb.ListRequest_STORE,
			withFields:      false,
			expectedAllowed: false,
		},
		{
			name:            "false when version match exact",
			withSearch:      true,
			source:          resourcepb.ListRequest_STORE,
			withFields:      true,
			versionMatchV2:  resourcepb.ResourceVersionMatchV2_Exact,
			expectedAllowed: false,
		},
		{
			name:            "false when version match not older than",
			withSearch:      true,
			source:          resourcepb.ListRequest_STORE,
			withFields:      true,
			versionMatchV2:  resourcepb.ResourceVersionMatchV2_NotOlderThan,
			expectedAllowed: false,
		},
		{
			name:            "true when store, fields, and search client",
			withSearch:      true,
			source:          resourcepb.ListRequest_STORE,
			withFields:      true,
			expectedAllowed: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := &resourcepb.ListRequest{
				Source:         tc.source,
				VersionMatchV2: tc.versionMatchV2,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "ns"},
				},
			}
			if tc.withFields {
				req.Options.Fields = []*resourcepb.Requirement{{Key: "spec.foo"}}
			}

			s := &server{}
			if tc.withSearch {
				s.searchClient = &stubSearchClient{}
			}

			require.Equal(t, tc.expectedAllowed, s.useFieldSelectorSearch(req))
		})
	}
}

func TestFilterFieldSelectors(t *testing.T) {
	tests := []struct {
		name          string
		namespace     string
		fields        []*resourcepb.Requirement
		wantFieldKeys []string
	}{
		{
			name:      "removes metadata.namespace and keep valid field",
			namespace: "ns",
			fields: []*resourcepb.Requirement{
				{Key: "metadata.namespace", Operator: "=", Values: []string{"ns"}},
				{Key: "spec.foo"},
			},
			wantFieldKeys: []string{"spec.foo"},
		},
		{
			name:      "removes multiple unsupported fields",
			namespace: "ns",
			fields: []*resourcepb.Requirement{
				{Key: "metadata.namespace", Operator: "=", Values: []string{"ns", "other"}},
				{Key: "spec.foo", Operator: "!="},
			},
			wantFieldKeys: []string{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := &resourcepb.ListRequest{
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: tc.namespace},
					Fields: tc.fields,
				},
			}

			out := filterFieldSelectors(req)

			gotKeys := make([]string, 0, len(out.Options.Fields))
			for _, f := range out.Options.Fields {
				gotKeys = append(gotKeys, f.Key)
			}
			require.Equal(t, tc.wantFieldKeys, gotKeys)
		})
	}
}

func TestListWithFieldSelectors(t *testing.T) {
	searchServerRv := int64(100)

	t.Run("a single page result will have index rv and no next page token", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:             &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r", Name: "a"},
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
				Key:    &resourcepb.ResourceKey{Namespace: "ns"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithFieldSelectors(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Items, 1)
		require.Equal(t, searchServerRv, resp.ResourceVersion)
		require.Empty(t, resp.NextPageToken)
	})

	t.Run("first page of paginated result will have next page token set and correct number of results", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		searchClient := &stubSearchClient{
			resp: &resourcepb.ResourceSearchResponse{
				ResourceVersion: searchServerRv,
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:             &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r", Name: "a"},
							ResourceVersion: 1,
							SortFields:      []string{"s1"},
						},
						{
							Key:             &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r", Name: "b"},
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
				Key:    &resourcepb.ResourceKey{Namespace: "ns"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithFieldSelectors(ctx, req)
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
							Key:             &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r", Name: "b"},
							ResourceVersion: 2,
							SortFields:      []string{"s2"},
						},
						{
							Key:             &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r", Name: "c"},
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
				Key:    &resourcepb.ResourceKey{Namespace: "ns"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithFieldSelectors(ctx, req)
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
							Key:             &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r", Name: "a"},
							ResourceVersion: 1,
							SortFields:      []string{"s1"},
						},
						{
							Key:             &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r", Name: "b"},
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
				Key:    &resourcepb.ResourceKey{Namespace: "ns"},
				Fields: []*resourcepb.Requirement{{Key: "spec.foo"}},
			},
		}

		resp, err := s.listWithFieldSelectors(ctx, req)

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
		backend:          fakeBackend{},
		access:           claims.FixedAccessClient(true),
		queue:            scheduler.NewNoopQueue(),
		queueConfig:      QueueConfig{Timeout: time.Second, MinBackoff: time.Millisecond, MaxBackoff: time.Millisecond, MaxRetries: 1},
		maxPageSizeBytes: maxPageSizeBytes,
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

type fakeBackend struct{}

func (fakeBackend) WriteEvent(context.Context, WriteEvent) (int64, error) { return 0, nil }
func (fakeBackend) ReadResource(_ context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	return &BackendReadResponse{
		Key:             req.Key,
		ResourceVersion: req.ResourceVersion,
		Value:           []byte("value"),
	}
}
func (fakeBackend) ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, nil
}
func (fakeBackend) ListHistory(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, nil
}
func (fakeBackend) ListModifiedSince(context.Context, NamespacedResource, int64) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 0, func(func(*ModifiedResource, error) bool) {}
}
func (fakeBackend) WatchWriteEvents(context.Context) (<-chan *WrittenEvent, error) {
	return nil, nil
}
func (fakeBackend) GetResourceStats(context.Context, NamespacedResource, int) ([]ResourceStats, error) {
	return nil, nil
}
func (fakeBackend) GetResourceLastImportTimes(context.Context) iter.Seq2[ResourceLastImportTime, error] {
	return func(func(ResourceLastImportTime, error) bool) {}
}
