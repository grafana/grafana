package resource

import (
	"context"
	"iter"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestListTrashWithSearch(t *testing.T) {
	ctx, metricsState := withRequestMetricsState(identity.WithServiceIdentityContext(context.Background(), 1))
	key := &resourcepb.ResourceKey{
		Namespace: "nsx",
		Group:     "advisor.grafana.app",
		Resource:  "advisors",
		Name:      "deleted-a",
	}
	searchResp := &resourcepb.ResourceSearchResponse{
		ResourceVersion: 100,
		ResultFormat:    resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Rows: []*resourcepb.ResourceSearchRow{{
			Key: key, ResourceVersion: 42, SortFields: []string{"deleted-a"},
		}},
	}
	backend := &trashBatchFakeBackend{value: trashObjectJSON(t, key, "folder-a", "deleter", false)}
	s, searchClient := newSearchBackedTrashTestServer(searchResp, backend)

	resp, err := s.List(ctx, trashListRequest())

	require.NoError(t, err)
	require.Nil(t, resp.Error)
	require.Len(t, resp.Items, 1)
	require.Equal(t, int64(42), resp.Items[0].ResourceVersion)
	require.Equal(t, 1, backend.batchCalls)
	require.NotNil(t, searchClient.last)
	require.True(t, searchClient.last.IsDeleted)
	require.Equal(t, []string{SEARCH_FIELD_RV}, searchClient.last.Fields)
	require.Equal(t, []*resourcepb.ResourceSearchRequest_Sort{{Field: SEARCH_FIELD_DELETED_RV, Desc: true}}, searchClient.last.SortBy)
	require.Equal(t, listPathTrashSearch, metricsState.listPath)
}

func TestShouldUseSearchForTrash(t *testing.T) {
	base := func() *resourcepb.ListRequest {
		return &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_TRASH,
			Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
				Namespace: "nsx",
				Group:     "advisor.grafana.app",
				Resource:  "checks",
			}},
		}
	}

	tests := map[string]struct {
		mutate      func(*resourcepb.ListRequest)
		disable     bool
		allowlisted bool
		want        bool
	}{
		"allowlisted trash": {allowlisted: true, want: true},
		"no search":         {disable: true, allowlisted: true},
		"store source":      {allowlisted: true, mutate: func(req *resourcepb.ListRequest) { req.Source = resourcepb.ListRequest_STORE }},
		"cross namespace":   {allowlisted: true, mutate: func(req *resourcepb.ListRequest) { req.Options.Key.Namespace = "" }},
		"named resource":    {allowlisted: true, mutate: func(req *resourcepb.ListRequest) { req.Options.Key.Name = "a" }},
		"not allowlisted":   {},
		"resource version":  {allowlisted: true, mutate: func(req *resourcepb.ListRequest) { req.ResourceVersion = 42 }},
		"exact version":     {allowlisted: true, mutate: func(req *resourcepb.ListRequest) { req.VersionMatchV2 = resourcepb.ResourceVersionMatchV2_Exact }},
		"not older than":    {allowlisted: true, mutate: func(req *resourcepb.ListRequest) { req.VersionMatchV2 = resourcepb.ResourceVersionMatchV2_NotOlderThan }},
		"kind absent from manifests": {allowlisted: true, want: true, mutate: func(req *resourcepb.ListRequest) {
			req.Options.Key.Group = "runtime.test"
			req.Options.Key.Resource = "runtimekinds"
		}},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			req := base()
			if tc.mutate != nil {
				tc.mutate(req)
			}
			s := &server{}
			if !tc.disable {
				s.searchClient = &stubSearchClient{}
			}
			allowed := map[string]bool{}
			if tc.allowlisted {
				allowed[req.Options.Key.Group+"/"+req.Options.Key.Resource] = true
			}
			s.searchBackedListResources = SearchBackedListConfig{AllowedResources: allowed}
			require.Equal(t, tc.want, s.shouldUseSearchForTrash(req))
		})
	}
}

func TestListTrashWithSearchFallsBackWhenIndexCannotServeTrash(t *testing.T) {
	tests := []struct {
		name    string
		message string
	}{
		{
			name:    "deleted documents unavailable",
			message: "trash is not available for this resource because indexing deleted documents is disabled",
		},
		{
			name:    "resource version sort unavailable",
			message: "sorting trash by resource version is not available for this resource until its search index has been rebuilt",
		},
		{
			name:    "search temporarily unavailable",
			message: "search is temporarily unavailable",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx, metricsState := withRequestMetricsState(identity.WithServiceIdentityContext(context.Background(), 1))
			searchResp := &resourcepb.ResourceSearchResponse{Error: NewServiceUnavailableError(test.message)}
			backend := &trashBatchFakeBackend{listRV: 77}
			s, _ := newSearchBackedTrashTestServer(searchResp, backend)

			resp, err := s.List(ctx, trashListRequest())

			require.NoError(t, err)
			require.Nil(t, resp.Error)
			require.Equal(t, int64(77), resp.ResourceVersion)
			require.Equal(t, 1, backend.listHistoryCalls)
			require.Zero(t, backend.batchCalls)
			require.Equal(t, listPathTrashSearchFallback, metricsState.listPath)
		})
	}
}

func TestListTrashWithSearchFallsBackFromRemoteUnavailableError(t *testing.T) {
	ctx, metricsState := withRequestMetricsState(identity.WithServiceIdentityContext(context.Background(), 1))
	searchErr := NewServiceUnavailableError("sorting trash by resource version is not available")
	grpcStatus, err := status.New(codes.Unavailable, searchErr.Message).WithDetails(searchErr)
	require.NoError(t, err)

	backend := &trashBatchFakeBackend{listRV: 77}
	s, searchClient := newSearchBackedTrashTestServer(nil, backend)
	searchClient.err = grpcStatus.Err()

	resp, err := s.List(ctx, trashListRequest())

	require.NoError(t, err)
	require.Nil(t, resp.Error)
	require.Equal(t, int64(77), resp.ResourceVersion)
	require.Equal(t, 1, backend.listHistoryCalls)
	require.Zero(t, backend.batchCalls)
	require.Equal(t, listPathTrashSearchFallback, metricsState.listPath)
}

func TestListTrashWithSearchDoesNotFallBackFromSearchContinueToken(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	searchResp := &resourcepb.ResourceSearchResponse{
		Error: NewServiceUnavailableError("sorting trash by resource version is not available for this resource until its search index has been rebuilt"),
	}
	backend := &trashBatchFakeBackend{listRV: 77}
	s, _ := newSearchBackedTrashTestServer(searchResp, backend)
	req := trashListRequest()
	req.NextPageToken = ContinueToken{SearchAfter: []string{"42"}, ResourceVersion: 100}.String()

	resp, err := s.List(ctx, req)

	require.NoError(t, err)
	require.Equal(t, int32(http.StatusServiceUnavailable), resp.Error.GetCode())
	require.Zero(t, backend.listHistoryCalls)
}

func TestListTrashWithSearchContinuesAfterFilteringRows(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	provisionedKey := &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors", Name: "provisioned"}
	visibleKey := &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors", Name: "visible"}
	searchResp := &resourcepb.ResourceSearchResponse{
		ResourceVersion: 100,
		ResultFormat:    resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Rows: []*resourcepb.ResourceSearchRow{
			{Key: provisionedKey, ResourceVersion: 41, SortFields: []string{"41"}},
			{Key: visibleKey, ResourceVersion: 42, SortFields: []string{"42"}},
		},
	}
	backend := &trashBatchFakeBackend{values: map[string][]byte{
		"provisioned": trashObjectJSON(t, provisionedKey, "folder-a", "deleter", true),
		"visible":     trashObjectJSON(t, visibleKey, "folder-a", "deleter", false),
	}}
	s, _ := newSearchBackedTrashTestServer(searchResp, backend)
	req := trashListRequest()
	req.Limit = 2

	resp, err := s.List(ctx, req)

	require.NoError(t, err)
	require.Nil(t, resp.Error)
	require.Len(t, resp.Items, 1)
	token, err := GetContinueToken(resp.NextPageToken)
	require.NoError(t, err)
	require.Equal(t, []string{"42"}, token.SearchAfter)
}

func TestListTrashWithSearchSkipsGarbageCollectedDeletionMarkers(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	visibleKey := &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors", Name: "visible"}
	staleKey := &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors", Name: "stale"}
	searchResp := &resourcepb.ResourceSearchResponse{
		ResourceVersion: 100,
		ResultFormat:    resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Rows: []*resourcepb.ResourceSearchRow{
			{Key: visibleKey, ResourceVersion: 42, SortFields: []string{"42"}},
			{Key: staleKey, ResourceVersion: 41, SortFields: []string{"41"}},
		},
	}
	backend := &trashBatchFakeBackend{
		values: map[string][]byte{"visible": trashObjectJSON(t, visibleKey, "folder-a", "deleter", false)},
		errors: map[string]*resourcepb.ErrorResult{"stale": NewNotFoundError(staleKey)},
	}
	s, _ := newSearchBackedTrashTestServer(searchResp, backend)
	req := trashListRequest()
	req.Limit = 2

	resp, err := s.List(ctx, req)

	require.NoError(t, err)
	require.Nil(t, resp.Error)
	require.Len(t, resp.Items, 1)
	require.Equal(t, backend.values["visible"], resp.Items[0].Value)
	token, err := GetContinueToken(resp.NextPageToken)
	require.NoError(t, err)
	require.Equal(t, []string{"41"}, token.SearchAfter)
}

func TestListTrashWithSearchFallsBackWhenBatchReadsAreUnsupported(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	key := &resourcepb.ResourceKey{Namespace: "nsx", Group: "advisor.grafana.app", Resource: "advisors", Name: "a"}
	searchResp := &resourcepb.ResourceSearchResponse{
		ResourceVersion: 100,
		Rows:            []*resourcepb.ResourceSearchRow{{Key: key, ResourceVersion: 42}},
		ResultFormat:    resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
	backend := &trashBatchFakeBackend{unsupported: true, listRV: 77}
	s, _ := newSearchBackedTrashTestServer(searchResp, backend)

	resp, err := s.List(ctx, trashListRequest())

	require.NoError(t, err)
	require.Nil(t, resp.Error)
	require.Equal(t, int64(77), resp.ResourceVersion)
	require.Equal(t, 1, backend.listHistoryCalls)
	require.Equal(t, 1, backend.batchCalls)
}

func TestListTrashWithSearchKeepsStoreTokenOnStorePath(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(context.Background(), 1)
	searchResp := &resourcepb.ResourceSearchResponse{
		ResourceVersion: 100,
		ResultFormat:    resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
	backend := &trashBatchFakeBackend{listRV: 77}
	s, searchClient := newSearchBackedTrashTestServer(searchResp, backend)
	req := trashListRequest()
	req.NextPageToken = ContinueToken{Name: "a", Namespace: "nsx", ResourceVersion: 42}.String()

	resp, err := s.List(ctx, req)

	require.NoError(t, err)
	require.Nil(t, resp.Error)
	require.Equal(t, int64(77), resp.ResourceVersion)
	require.Equal(t, 1, backend.listHistoryCalls)
	require.Nil(t, searchClient.last)
}

func newSearchBackedTrashTestServer(searchResp *resourcepb.ResourceSearchResponse, backend StorageBackend) (*server, *stubSearchClient) {
	searchClient := &stubSearchClient{resp: searchResp}
	s := createTestServer(searchClient, 1024)
	s.backend = backend
	s.searchBackedListResources = SearchBackedListConfig{AllowedResources: map[string]bool{
		"advisor.grafana.app/advisors": true,
	}}
	return s, searchClient
}

func trashListRequest() *resourcepb.ListRequest {
	return &resourcepb.ListRequest{
		Source: resourcepb.ListRequest_TRASH,
		Limit:  10,
		Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
			Namespace: "nsx",
			Group:     "advisor.grafana.app",
			Resource:  "advisors",
		}},
	}
}

type trashBatchFakeBackend struct {
	UnimplementedStorageBackend
	value            []byte
	values           map[string][]byte
	errors           map[string]*resourcepb.ErrorResult
	batchCalls       int
	unsupported      bool
	listHistoryCalls int
	listRV           int64
}

func (b *trashBatchFakeBackend) BatchReadResource(_ context.Context, requests []*resourcepb.ReadRequest, includeDeleted bool) (iter.Seq[*BackendReadResponse], error) {
	b.batchCalls++
	if b.unsupported || !includeDeleted {
		return nil, ErrBatchReadUnsupported
	}
	return func(yield func(*BackendReadResponse) bool) {
		for _, req := range requests {
			if errRes := b.errors[req.Key.Name]; errRes != nil {
				if !yield(&BackendReadResponse{Key: req.Key, Error: errRes}) {
					return
				}
				continue
			}
			value := b.value
			if b.values != nil {
				value = b.values[req.Key.Name]
			}
			if !yield(&BackendReadResponse{
				Key:             req.Key,
				ResourceVersion: req.ResourceVersion,
				Value:           value,
				Folder:          "folder-a",
			}) {
				return
			}
		}
	}, nil
}

func (b *trashBatchFakeBackend) ListHistory(_ context.Context, _ *resourcepb.ListRequest, _ func(ListIterator) error) (int64, error) {
	b.listHistoryCalls++
	if b.listRV == 0 {
		b.listRV = 99
	}
	return b.listRV, nil
}

func trashObjectJSON(t *testing.T, key *resourcepb.ResourceKey, folder, deletedBy string, provisioned bool) []byte {
	t.Helper()
	obj := &unstructured.Unstructured{}
	obj.SetAPIVersion(key.Group + "/v1")
	obj.SetKind("Advisor")
	obj.SetNamespace(key.Namespace)
	obj.SetName(key.Name)
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetFolder(folder)
	meta.SetUpdatedBy(deletedBy)
	if provisioned {
		meta.SetAnnotation(utils.AnnoKeyManagerKind, "repo")
	}
	value, err := obj.MarshalJSON()
	require.NoError(t, err)
	return value
}
