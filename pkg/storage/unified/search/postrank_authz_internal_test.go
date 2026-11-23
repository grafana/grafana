package search

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// This backend has no engine types, so these tests also check that the shared
// runner needs only the query contract, not a Bleve index or request.
type memoryQueryBackend struct {
	hits     []*queryHit
	requests []queryRequest
	onLookup func()
	failAt   string
	err      error
}

func (b *memoryQueryBackend) failure(ctx context.Context, operation string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if b.failAt == operation {
		return b.err
	}
	return nil
}

func (b *memoryQueryBackend) Search(ctx context.Context, req queryRequest) (queryResult, error) {
	if err := b.failure(ctx, "search"); err != nil {
		return queryResult{}, err
	}
	b.requests = append(b.requests, req)
	hits := slices.Clone(b.hits)
	if req.Reverse {
		slices.Reverse(hits)
	}
	result := queryResult{Total: uint64(len(hits))}
	for _, hit := range hits {
		if len(req.SearchAfter) > 0 {
			cmp := slices.Compare(hit.Cursor, req.SearchAfter)
			if (!req.Reverse && cmp <= 0) || (req.Reverse && cmp >= 0) {
				continue
			}
		}
		if len(result.Hits) == req.Size {
			break
		}
		candidate := *hit
		candidate.Fields = nil
		if len(req.Fields) > 0 {
			candidate.Fields = hit.Fields
		}
		result.Hits = append(result.Hits, &candidate)
	}
	return result, nil
}

func (b *memoryQueryBackend) ReadAuthzMetadata(ctx context.Context, ids []string) (queryMetadata, error) {
	if err := b.failure(ctx, "metadata"); err != nil {
		return queryMetadata{}, err
	}
	result := queryMetadata{Values: map[string]authzMetadata{}}
	for _, hit := range b.hits {
		if slices.Contains(ids, hit.ID) {
			folder, _ := hit.Fields[resource.SEARCH_FIELD_FOLDER].(string)
			result.Values[hit.ID] = authzMetadata{folder: folder}
		}
	}
	return result, nil
}

func (b *memoryQueryBackend) Lookup(ctx context.Context, req queryLookupRequest) (queryResult, error) {
	if err := b.failure(ctx, "lookup"); err != nil {
		return queryResult{}, err
	}
	if b.onLookup != nil {
		b.onLookup()
		b.onLookup = nil
	}
	result := queryResult{}
	for _, hit := range b.hits {
		if slices.Contains(req.IDs, hit.ID) {
			result.Hits = append(result.Hits, hit)
		}
	}
	return result, nil
}

func newMemoryPostRankSearch(t *testing.T) (context.Context, *postRankSearch, *memoryQueryBackend, *resourcepb.ResourceSearchRequest) {
	t.Helper()
	key := resource.NamespacedResource{Namespace: "default", Group: dashboardGroup, Resource: "dashboards"}
	backend := &memoryQueryBackend{}
	for i := range 13 {
		name := fmt.Sprintf("doc-%02d", i)
		folder := "other"
		if i%4 == 0 {
			folder = "team"
		}
		backend.hits = append(backend.hits, &queryHit{
			ID:     resource.SearchID(&resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name}),
			Cursor: queryCursor{name}, StableSortKey: queryStableSortKey{name},
			Fields: map[string]any{resource.SEARCH_FIELD_FOLDER: folder, resource.SEARCH_FIELD_TAGS: []string{name}},
		})
	}
	runner := &postRankSearch{
		key: key, backend: backend,
		config:       PostRankAuthzConfig{OverFetchFactor: 1, MaxWindow: 2, MaxCandidates: 1, FacetSampleSize: 3}.effective(),
		indexMetrics: resource.ProvideIndexMetrics(nil),
		facetField:   func(field string) string { return field },
	}
	req := &resourcepb.ResourceSearchRequest{Limit: 3, Permission: int64(dashboardaccess.PERMISSION_EDIT)}
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: key.Namespace})
	return ctx, runner, backend, req
}

func TestPostRankSearchWithQueryBackend(t *testing.T) {
	t.Run("fills a page beyond the counting budget", func(t *testing.T) {
		ctx, runner, backend, req := newMemoryPostRankSearch(t)
		response := &resourcepb.ResourceSearchResponse{}
		hits, err := runner.run(ctx, verbAccessClient{}, req, queryRequest{}, nil, response, nil)
		require.NoError(t, err)
		require.Equal(t, []string{"doc-00", "doc-04", "doc-08"}, queryHitNames(hits))
		require.Greater(t, len(backend.requests), runner.config.MaxCandidates)
		require.Equal(t, int64(13), response.TotalHits)
		require.False(t, response.TotalHitsExact)
	})

	t.Run("facets start at the top while a page scans backwards", func(t *testing.T) {
		ctx, runner, backend, req := newMemoryPostRankSearch(t)
		req.Limit = 2
		req.SearchBefore = []string{"doc-09"}
		req.Facet = map[string]*resourcepb.ResourceSearchRequest_Facet{"tags": {Field: resource.SEARCH_FIELD_TAGS, Limit: 10}}
		response := &resourcepb.ResourceSearchResponse{}
		hits, err := runner.run(ctx, verbAccessClient{}, req, queryRequest{SearchAfter: req.SearchBefore, Reverse: true}, nil, response, nil)
		require.NoError(t, err)
		require.Equal(t, []string{"doc-04", "doc-08"}, queryHitNames(hits))
		require.False(t, backend.requests[0].Reverse)
		require.Empty(t, backend.requests[0].SearchAfter)
		require.Equal(t, []*resourcepb.ResourceSearchResponse_TermFacet{{Term: "doc-00", Count: 1}}, response.Facet["tags"].Terms)
	})

	t.Run("refills after a document changes during authorization", func(t *testing.T) {
		ctx, runner, backend, req := newMemoryPostRankSearch(t)
		backend.onLookup = func() { backend.hits[0].Fields[resource.SEARCH_FIELD_FOLDER] = "other" }
		hits, err := runner.run(ctx, verbAccessClient{}, req, queryRequest{}, nil, &resourcepb.ResourceSearchResponse{}, nil)
		require.NoError(t, err)
		require.Equal(t, []string{"doc-04", "doc-08", "doc-12"}, queryHitNames(hits))
	})
}

func TestPostRankExactCounting(t *testing.T) {
	for _, global := range []bool{false, true} {
		t.Run(fmt.Sprintf("global=%t", global), func(t *testing.T) {
			ctx, runner, _, req := newMemoryPostRankSearch(t)
			if global {
				runner.key = resource.GlobalSearchKey("default")
			}
			runner.config.ExactCountThreshold = 13
			response := &resourcepb.ResourceSearchResponse{}
			_, err := runner.run(ctx, verbAccessClient{}, req, queryRequest{}, nil, response, nil)
			require.NoError(t, err)
			require.Equal(t, global, response.TotalHitsExact)
			if global {
				require.Equal(t, int64(4), response.TotalHits)
			} else {
				require.Equal(t, int64(13), response.TotalHits)
			}
		})
	}
	// Size 1 reaches the cap at a window boundary; size 2 leaves an unread hit.
	for _, window := range []int{1, 2} {
		t.Run(fmt.Sprintf("insert before last visible hit/window=%d", window), func(t *testing.T) {
			ctx, runner, backend, req := newMemoryPostRankSearch(t)
			runner.key = resource.GlobalSearchKey("default")
			runner.config.ExactCountThreshold = 13
			runner.config.MaxWindow = window
			backend.onLookup = func() {
				inserted := *backend.hits[11]
				inserted.ID += "-inserted"
				inserted.Cursor = queryCursor{"doc-11-inserted"}
				backend.hits = slices.Insert(backend.hits, 12, &inserted)
			}
			response := &resourcepb.ResourceSearchResponse{}
			_, err := runner.run(ctx, verbAccessClient{}, req, queryRequest{}, nil, response, nil)
			require.NoError(t, err)
			require.False(t, response.TotalHitsExact)
		})
	}
	t.Run("individual authorization error", func(t *testing.T) {
		ctx, runner, _, req := newMemoryPostRankSearch(t)
		runner.key = resource.GlobalSearchKey("default")
		runner.config.ExactCountThreshold = 13
		checkErr := errors.New("authorization unavailable")
		_, err := runner.run(ctx, itemErrorAccessClient{err: checkErr}, req, queryRequest{}, nil, &resourcepb.ResourceSearchResponse{}, nil)
		require.ErrorIs(t, err, checkErr)
	})
}

type itemErrorAccessClient struct {
	verbAccessClient
	err error
}

func (c itemErrorAccessClient) BatchCheck(ctx context.Context, user authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	response, err := c.verbAccessClient.BatchCheck(ctx, user, req)
	for _, check := range req.Checks {
		if check.Name == "doc-12" {
			response.Results[check.CorrelationID] = authlib.BatchCheckResult{Error: c.err}
		}
	}
	return response, err
}

func TestPostRankSearchBackendErrors(t *testing.T) {
	for _, operation := range []string{"search", "metadata", "lookup"} {
		t.Run(operation, func(t *testing.T) {
			ctx, runner, backend, req := newMemoryPostRankSearch(t)
			backend.failAt, backend.err = operation, errors.New("backend unavailable")
			hits, err := runner.run(ctx, verbAccessClient{}, req, queryRequest{}, nil, &resourcepb.ResourceSearchResponse{}, nil)
			require.ErrorIs(t, err, backend.err)
			require.Nil(t, hits)
		})
	}
	t.Run("cancellation", func(t *testing.T) {
		ctx, runner, _, req := newMemoryPostRankSearch(t)
		ctx, cancel := context.WithCancel(ctx)
		cancel()
		hits, err := runner.run(ctx, verbAccessClient{}, req, queryRequest{}, nil, &resourcepb.ResourceSearchResponse{}, nil)
		require.ErrorIs(t, err, context.Canceled)
		require.Nil(t, hits)
	})
}

func queryHitNames(hits []*queryHit) []string {
	names := make([]string, len(hits))
	for i, hit := range hits {
		var key resourcepb.ResourceKey
		_ = resource.ReadSearchID(&key, hit.ID)
		names[i] = key.Name
	}
	return names
}
