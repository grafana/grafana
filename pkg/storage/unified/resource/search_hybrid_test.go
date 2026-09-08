package resource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

func hybridKey() *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r"}
}

func TestFuseRRF_OverlapRanksHighest(t *testing.T) {
	lex := []lexicalHit{
		{uid: "a", title: "A", folder: "f1", managerKind: "repo", managerID: "m1"},
		{uid: "b", title: "B", folder: "f2"},
	}
	sem := []vector.VectorSearchResult{
		{UID: "c", Title: "C", Subresource: "panel/1", Content: "c1", Score: 0.1, Folder: "f3"},
		{UID: "a", Title: "A-stale", Subresource: "panel/2", Content: "a2", Score: 0.2, Metadata: []byte(`{"k":"v"}`)},
	}

	out := fuseRRF(hybridKey(), lex, sem)
	require.Len(t, out, 3)

	// dual-leg: lexical rank 1 + semantic rank 2
	assert.Equal(t, "a", out[0].Key.Name)
	assert.Equal(t, "ns", out[0].Key.Namespace)
	assert.Equal(t, "g", out[0].Key.Group)
	assert.Equal(t, "r", out[0].Key.Resource)
	assert.InDelta(t, 1.0/61+1.0/62, out[0].Score, 1e-12)
	// lexical title wins over the embeddings row's stale title
	assert.Equal(t, "A", out[0].Title)
	assert.Equal(t, "f1", out[0].Folder)
	assert.Equal(t, "repo", out[0].ManagedByKind)
	assert.Equal(t, "m1", out[0].ManagedById)
	require.Len(t, out[0].Chunks, 1)
	assert.Equal(t, "panel/2", out[0].Chunks[0].Subresource)
	assert.Equal(t, "a2", out[0].Chunks[0].Content)
	assert.Equal(t, []byte(`{"k":"v"}`), out[0].Chunks[0].Metadata)

	// single-leg rank-1: "c" (1/61) beats "b" (1/62)
	assert.Equal(t, "c", out[1].Key.Name)
	assert.Equal(t, "C", out[1].Title)
	assert.Equal(t, "f3", out[1].Folder)
	assert.Equal(t, "b", out[2].Key.Name)
}

func TestFuseRRF_GroupsChunksPerUID(t *testing.T) {
	sem := []vector.VectorSearchResult{
		{UID: "a", Subresource: "panel/1", Content: "best", Score: 0.1},
		{UID: "b", Subresource: "panel/2", Content: "b", Score: 0.3},
		{UID: "a", Subresource: "panel/9", Content: "second", Score: 0.5},
	}

	out := fuseRRF(hybridKey(), nil, sem)
	require.Len(t, out, 2)

	// "a" groups both chunks best-first; rank comes from the best chunk
	assert.Equal(t, "a", out[0].Key.Name)
	require.Len(t, out[0].Chunks, 2)
	assert.Equal(t, "panel/1", out[0].Chunks[0].Subresource)
	assert.Equal(t, "panel/9", out[0].Chunks[1].Subresource)
	assert.InDelta(t, 1.0/61, out[0].Score, 1e-12)

	// duplicate-uid chunks don't consume semantic ranks: "b" is rank 2
	assert.Equal(t, "b", out[1].Key.Name)
	assert.InDelta(t, 1.0/62, out[1].Score, 1e-12)
}

func TestFuseRRF_ChunkCap(t *testing.T) {
	sem := make([]vector.VectorSearchResult, 0, maxChunksPerHybridResult+5)
	for i := 0; i < maxChunksPerHybridResult+5; i++ {
		sem = append(sem, vector.VectorSearchResult{
			UID: "a", Subresource: fmt.Sprintf("panel/%d", i), Content: "c", Score: float64(i),
		})
	}
	out := fuseRRF(hybridKey(), nil, sem)
	require.Len(t, out, 1)
	assert.Len(t, out[0].Chunks, maxChunksPerHybridResult)
	assert.Equal(t, "panel/0", out[0].Chunks[0].Subresource)
}

func TestFuseRRF_LexicalOnlySynthesizesTitleChunk(t *testing.T) {
	lex := []lexicalHit{{uid: "a", title: "My Dashboard", folder: "f"}}
	out := fuseRRF(hybridKey(), lex, nil)
	require.Len(t, out, 1)
	require.Len(t, out[0].Chunks, 1)
	assert.Equal(t, "", out[0].Chunks[0].Subresource)
	assert.Equal(t, "My Dashboard", out[0].Chunks[0].Content)
	assert.Nil(t, out[0].Chunks[0].Metadata)
}

func TestFuseRRF_LexicalRootFolderNotOverwrittenByStaleSemanticFolder(t *testing.T) {
	// "" is the legacy root-folder value, not "unset": a dual-leg hit in
	// the root folder must keep it even when the embeddings row carries a
	// stale non-empty folder.
	lex := []lexicalHit{{uid: "a", title: "A", folder: ""}}
	sem := []vector.VectorSearchResult{
		{UID: "a", Title: "A-stale", Folder: "old-folder", Subresource: "panel/1", Content: "c", Score: 0.1},
	}

	out := fuseRRF(hybridKey(), lex, sem)
	require.Len(t, out, 1)
	assert.Equal(t, "", out[0].Folder)
	assert.Equal(t, "A", out[0].Title)

	// semantic-only hits still get their display fields from the
	// embeddings row
	out = fuseRRF(hybridKey(), nil, sem)
	require.Len(t, out, 1)
	assert.Equal(t, "old-folder", out[0].Folder)
	assert.Equal(t, "A-stale", out[0].Title)
}

func TestFuseRRF_SemanticOnlyTitlePrefersDashboardTitleMetadata(t *testing.T) {
	// Embeddings row titles are chunk-qualified ("Dashboard — Panel");
	// semantic-only hits should surface the resource-level title from
	// metadata when present.
	sem := []vector.VectorSearchResult{
		{UID: "a", Title: "Clean — Panel 5", Metadata: []byte(`{"dashboardTitle":"Clean"}`), Score: 0.1},
		{UID: "b", Title: "Fallback — Panel", Metadata: []byte(`{"other":"x"}`), Score: 0.2},
		{UID: "c", Title: "NoMeta — Panel", Score: 0.3},
	}

	out := fuseRRF(hybridKey(), nil, sem)
	require.Len(t, out, 3)
	assert.Equal(t, "Clean", out[0].Title)
	assert.Equal(t, "Fallback — Panel", out[1].Title)
	assert.Equal(t, "NoMeta — Panel", out[2].Title)
}

func TestFuseRRF_TieBreaksByName(t *testing.T) {
	lex := []lexicalHit{{uid: "z", title: "Z"}}
	sem := []vector.VectorSearchResult{{UID: "m", Title: "M", Score: 0.1}}
	out := fuseRRF(hybridKey(), lex, sem)
	require.Len(t, out, 2)
	assert.Equal(t, "m", out[0].Key.Name)
	assert.Equal(t, "z", out[1].Key.Name)
}

func TestFuseRRF_Empty(t *testing.T) {
	assert.Empty(t, fuseRRF(hybridKey(), nil, nil))
}

func lexTableResponse(rows ...[3]string) *resourcepb.ResourceSearchResponse {
	table := &resourcepb.ResourceTable{
		Columns: []*resourcepb.ResourceTableColumnDefinition{
			{Name: SEARCH_FIELD_TITLE, Type: resourcepb.ResourceTableColumnDefinition_STRING},
			{Name: SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
		},
	}
	for _, r := range rows {
		table.Rows = append(table.Rows, &resourcepb.ResourceTableRow{
			Key:   &resourcepb.ResourceKey{Name: r[0]},
			Cells: [][]byte{[]byte(r[1]), []byte(r[2])},
		})
	}
	return &resourcepb.ResourceSearchResponse{Results: table}
}

func managerTableResponse(rows ...[3]string) *resourcepb.ResourceSearchResponse {
	table := &resourcepb.ResourceTable{
		Columns: []*resourcepb.ResourceTableColumnDefinition{
			{Name: SEARCH_FIELD_MANAGER_KIND, Type: resourcepb.ResourceTableColumnDefinition_STRING},
			{Name: SEARCH_FIELD_MANAGER_ID, Type: resourcepb.ResourceTableColumnDefinition_STRING},
		},
	}
	for _, r := range rows {
		table.Rows = append(table.Rows, &resourcepb.ResourceTableRow{
			Key:   &resourcepb.ResourceKey{Name: r[0]},
			Cells: [][]byte{[]byte(r[1]), []byte(r[2])},
		})
	}
	return &resourcepb.ResourceSearchResponse{Results: table}
}

func TestLexicalHitsFromResponse(t *testing.T) {
	hits := lexicalHitsFromResponse(lexTableResponse(
		[3]string{"u1", "Title One", "f1"},
		[3]string{"u2", "Title Two", "f2"},
	))
	require.Len(t, hits, 2)
	assert.Equal(t, lexicalHit{uid: "u1", title: "Title One", folder: "f1"}, hits[0])
	assert.Equal(t, lexicalHit{uid: "u2", title: "Title Two", folder: "f2"}, hits[1])
}

func TestLexicalHitsFromResponse_ManagerColumns(t *testing.T) {
	resp := &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
		Columns: []*resourcepb.ResourceTableColumnDefinition{
			{Name: SEARCH_FIELD_TITLE, Type: resourcepb.ResourceTableColumnDefinition_STRING},
			{Name: SEARCH_FIELD_MANAGER_KIND, Type: resourcepb.ResourceTableColumnDefinition_STRING},
			{Name: SEARCH_FIELD_MANAGER_ID, Type: resourcepb.ResourceTableColumnDefinition_STRING},
		},
		Rows: []*resourcepb.ResourceTableRow{{
			Key:   &resourcepb.ResourceKey{Name: "u1"},
			Cells: [][]byte{[]byte("Title"), []byte("repo"), []byte("m1")},
		}},
	}}
	hits := lexicalHitsFromResponse(resp)
	require.Len(t, hits, 1)
	assert.Equal(t, lexicalHit{uid: "u1", title: "Title", managerKind: "repo", managerID: "m1"}, hits[0])
}

func TestLexicalHitsFromResponse_MissingColumnsAndNil(t *testing.T) {
	assert.Empty(t, lexicalHitsFromResponse(nil))
	assert.Empty(t, lexicalHitsFromResponse(&resourcepb.ResourceSearchResponse{}))

	resp := &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
		Rows: []*resourcepb.ResourceTableRow{{Key: &resourcepb.ResourceKey{Name: "u1"}}},
	}}
	hits := lexicalHitsFromResponse(resp)
	require.Len(t, hits, 1)
	assert.Equal(t, lexicalHit{uid: "u1"}, hits[0])
}

func TestValidateHybridSearchRequest(t *testing.T) {
	valid := func() *resourcepb.HybridSearchRequest {
		return &resourcepb.HybridSearchRequest{Key: hybridKey(), Query: "q"}
	}

	assert.Nil(t, validateHybridSearchRequest(valid()))

	r := valid()
	r.Key = nil
	require.NotNil(t, validateHybridSearchRequest(r))

	r = valid()
	r.Query = "  "
	require.NotNil(t, validateHybridSearchRequest(r))

	r = valid()
	r.Query = strings.Repeat("x", 1001)
	require.NotNil(t, validateHybridSearchRequest(r))

	r = valid()
	r.SemanticQuery = strings.Repeat("x", 1001)
	require.NotNil(t, validateHybridSearchRequest(r))

	// All validation failures are InvalidArgument status errors, never
	// response-embedded.
	wantInvalid := func(err error, contains string) {
		t.Helper()
		require.Error(t, err)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
		assert.Contains(t, err.Error(), contains)
	}

	// Kind-specific key checks live in validateHybridSearchFilters.
	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "tags", Operator: "in", Values: []string{"prod"}}}
	assert.Nil(t, validateHybridSearchRequest(r))
	wantInvalid(validateHybridSearchFilters(r, false), "tags")
	assert.Nil(t, validateHybridSearchFilters(r, true))

	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "", Operator: "in", Values: []string{"x"}}}
	wantInvalid(validateHybridSearchRequest(r), "empty")

	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "uid", Operator: "in"}}
	wantInvalid(validateHybridSearchRequest(r), "no values")

	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "uid", Operator: "notin", Values: []string{"u1"}}}
	wantInvalid(validateHybridSearchRequest(r), "operator")

	r = valid()
	r.SemanticQuery = "   "
	wantInvalid(validateHybridSearchRequest(r), "whitespace")

	r = valid()
	r.Filters = []*resourcepb.Requirement{
		{Key: "uid", Operator: "in", Values: []string{"u1"}},
		{Key: "uid", Operator: "in", Values: []string{"u2"}},
	}
	wantInvalid(validateHybridSearchRequest(r), "duplicate")

	r = valid()
	r.Key.Resource = "dashboards"
	r.Filters = []*resourcepb.Requirement{{Key: "language", Operator: "in", Values: []string{"promql", "cypher"}}}
	wantInvalid(validateHybridSearchFilters(r, false), "cypher")

	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "datasource_uid", Operator: "in", Values: []string{"d"}}}
	wantInvalid(validateHybridSearchFilters(r, false), "dashboards")

	r = valid()
	r.Key.Resource = "dashboards"
	r.Filters = []*resourcepb.Requirement{
		{Key: "uid", Operator: "in", Values: []string{"u"}},
		{Key: "folder", Operator: "in", Values: []string{"f"}},
		{Key: "datasource_uid", Operator: "in", Values: []string{"d"}},
		{Key: "language", Operator: "in", Values: []string{"promql"}},
	}
	assert.Nil(t, validateHybridSearchRequest(r))
	assert.Nil(t, validateHybridSearchFilters(r, false))

	// External contract: no key allowlist.
	r = valid()
	r.Filters = []*resourcepb.Requirement{
		{Key: "uid", Operator: "in", Values: []string{"u"}},
		{Key: "folder", Operator: "in", Values: []string{"f"}},
		{Key: "folderUid", Operator: "in", Values: []string{"f"}},
		{Key: "labels", Operator: "in", Values: []string{"team=infra"}},
	}
	assert.Nil(t, validateHybridSearchFilters(r, true))

	r = valid()
	r.MinRelevance = "low"
	assert.Nil(t, validateHybridSearchRequest(r))

	r = valid()
	r.MinRelevance = ""
	assert.Nil(t, validateHybridSearchRequest(r))

	r = valid()
	r.MinRelevance = "med"
	wantInvalid(validateHybridSearchRequest(r), "unsupported min_relevance")

	r = valid()
	r.MinRelevance = "0.5"
	wantInvalid(validateHybridSearchRequest(r), "unsupported min_relevance")

	r = valid()
	r.SkipRerank = true
	assert.Nil(t, validateHybridSearchRequest(r))

	r = valid()
	r.SkipRerank = true
	r.MinRelevance = "low"
	wantInvalid(validateHybridSearchRequest(r), "min_relevance cannot be combined with skip_rerank")
}

func TestHybridLexicalRequest(t *testing.T) {
	req := &resourcepb.HybridSearchRequest{
		Key:   hybridKey(),
		Query: "cpu",
		Filters: []*resourcepb.Requirement{
			{Key: "uid", Operator: "in", Values: []string{"u1"}},
			{Key: "folder", Operator: "in", Values: []string{"f1"}},
			{Key: "datasource_uid", Operator: "in", Values: []string{"ds1"}},
			{Key: "language", Operator: "in", Values: []string{"promql", "logql"}},
		},
	}
	out := hybridLexicalRequest(req, 40)

	assert.Equal(t, "cpu", out.Query)
	assert.Equal(t, int64(40), out.Limit)
	assert.Same(t, req.Key, out.Options.Key)
	assert.Equal(t, []string{SEARCH_FIELD_TITLE, SEARCH_FIELD_FOLDER, SEARCH_FIELD_MANAGER_KIND, SEARCH_FIELD_MANAGER_ID}, out.Fields)

	require.Len(t, out.Options.Fields, 4)
	assert.Equal(t, SEARCH_FIELD_NAME, out.Options.Fields[0].Key)
	assert.Equal(t, []string{"u1"}, out.Options.Fields[0].Values)
	assert.Equal(t, SEARCH_FIELD_FOLDER, out.Options.Fields[1].Key)
	assert.Equal(t, "reference.DataSource", out.Options.Fields[2].Key)
	assert.Equal(t, []string{"ds1"}, out.Options.Fields[2].Values)
	assert.Equal(t, SEARCH_FIELD_PREFIX+"ds_types", out.Options.Fields[3].Key)
	want := append(append([]string{}, languageToDSTypes["promql"]...), languageToDSTypes["logql"]...)
	assert.ElementsMatch(t, want, out.Options.Fields[3].Values)
}

func TestHybridVectorFilters(t *testing.T) {
	filters := hybridVectorFilters([]*resourcepb.Requirement{
		{Key: "uid", Operator: "in", Values: []string{"u1"}},
		{Key: "folder", Operator: "in", Values: []string{"f1"}},
		{Key: "datasource_uid", Operator: "in", Values: []string{"ds1", "ds2"}},
		{Key: "language", Operator: "in", Values: []string{"promql"}},
	})
	require.Len(t, filters, 4)
	assert.Equal(t, vector.SearchFilter{Field: "uid", Values: []string{"u1"}}, filters[0])
	assert.Equal(t, vector.SearchFilter{Field: "folder", Values: []string{"f1"}}, filters[1])
	assert.Equal(t, vector.SearchFilter{Field: "datasourceUid", Values: []string{"ds1", "ds2"}}, filters[2])
	assert.Equal(t, vector.SearchFilter{Field: "language", Values: []string{"promql"}}, filters[3])
}

func TestHybridVectorFilters_RootFolderSentinels(t *testing.T) {
	// filtering by either root sentinel must match rows stored with the other
	f := hybridVectorFilters([]*resourcepb.Requirement{
		{Key: "folder", Operator: "in", Values: []string{"general"}},
	})
	require.Len(t, f, 1)
	assert.ElementsMatch(t, []string{"general", ""}, f[0].Values)

	f = hybridVectorFilters([]*resourcepb.Requirement{
		{Key: "folder", Operator: "in", Values: []string{"", "f1"}},
	})
	require.Len(t, f, 1)
	assert.ElementsMatch(t, []string{"", "f1", "general"}, f[0].Values)

	f = hybridVectorFilters([]*resourcepb.Requirement{
		{Key: "folder", Operator: "in", Values: []string{"f1"}},
	})
	require.Len(t, f, 1)
	assert.Equal(t, []string{"f1"}, f[0].Values)
}

func TestHybridFetchDepth(t *testing.T) {
	assert.Equal(t, 20, hybridFetchDepth(10))
	assert.Equal(t, 200, hybridFetchDepth(150))
}

type fakeSearchBackend struct {
	idx ResourceIndex
}

func (f *fakeSearchBackend) LoadOpenIndexStats(time.Time, time.Duration) ([]ResourceStats, error) {
	return nil, nil
}
func (f *fakeSearchBackend) WriteOpenIndexStats(time.Time) error       { return nil }
func (f *fakeSearchBackend) GetIndex(NamespacedResource) ResourceIndex { return f.idx }
func (f *fakeSearchBackend) TotalDocs() int64                          { return 0 }
func (f *fakeSearchBackend) GetOpenIndexes() []NamespacedResource      { return nil }
func (f *fakeSearchBackend) RemoveExpiredTrash(context.Context)        {}
func (f *fakeSearchBackend) SnapshotCountThreshold() int64             { return 0 }
func (f *fakeSearchBackend) Stop()                                     {}
func (f *fakeSearchBackend) BuildIndex(context.Context, NamespacedResource, int64, string, BuildFn, UpdateFn, bool, time.Time, time.Duration) (ResourceIndex, error) {
	return f.idx, nil
}

type hybridFakeIndex struct {
	MockResourceIndex
	mu     sync.Mutex
	resp   *resourcepb.ResourceSearchResponse
	err    error
	gotReq *resourcepb.ResourceSearchRequest

	// Folder-title resolution issues a second Search against the folders
	// index; route it separately so lexical-leg assertions stay stable.
	folderResp   *resourcepb.ResourceSearchResponse
	folderErr    error
	gotFolderReq *resourcepb.ResourceSearchRequest

	// Managed-by resolution reuses the lexical leg's index with no Query;
	// route by that.
	managedByResp   *resourcepb.ResourceSearchResponse
	managedByErr    error
	gotManagedByReq *resourcepb.ResourceSearchRequest
}

func (h *hybridFakeIndex) Search(_ context.Context, _ authlib.AccessClient, req *resourcepb.ResourceSearchRequest, _ []ResourceIndex, _ *SearchStats) (*resourcepb.ResourceSearchResponse, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if req.Options.GetKey().GetResource() == "folders" {
		h.gotFolderReq = req
		if h.folderResp == nil && h.folderErr == nil {
			return lexTableResponse(), nil
		}
		return h.folderResp, h.folderErr
	}
	if req.Query == "" {
		h.gotManagedByReq = req
		if h.managedByResp == nil && h.managedByErr == nil {
			return lexTableResponse(), nil
		}
		return h.managedByResp, h.managedByErr
	}
	h.gotReq = req
	return h.resp, h.err
}

func newHybridTestServer(lexResp *resourcepb.ResourceSearchResponse, backend *fakeVectorBackend, access ...authlib.AccessClient) (*searchServer, *hybridFakeIndex, *fakeTextEmbedder) {
	idx := &hybridFakeIndex{resp: lexResp}
	emb := &fakeTextEmbedder{dim: 4}
	s := newTestSearchServer(newTestEmbedder(emb), backend, access...)
	s.search = &fakeSearchBackend{idx: idx}
	if s.vectorMetrics == nil {
		s.vectorMetrics = ProvideVectorMetrics(prometheus.NewRegistry())
	}
	return s, idx, emb
}

func TestHybridSearch_FusesBothLegs(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"both", "Both Legs", "f1"},
		[3]string{"lexonly", "Lex Only", "f2"},
	)
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{
			{UID: "semonly", Title: "Sem Only", Subresource: "panel/1", Content: "s1", Score: 0.1, Folder: "f3"},
			{UID: "both", Title: "Both Legs", Subresource: "panel/2", Content: "b2", Score: 0.2, Folder: "f1"},
		},
	}
	s, idx, _ := newHybridTestServer(lexResp, backend)

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "api latency", Limit: 10,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 3)

	assert.Equal(t, "both", resp.Results[0].Key.Name)
	assert.InDelta(t, 1.0/61+1.0/62, resp.Results[0].Score, 1e-12)
	require.Len(t, resp.Results[0].Chunks, 1)
	assert.Equal(t, "panel/2", resp.Results[0].Chunks[0].Subresource)

	// lexical-only hit carries a synthesized title chunk
	for _, r := range resp.Results {
		if r.Key.Name == "lexonly" {
			require.Len(t, r.Chunks, 1)
			assert.Equal(t, "Lex Only", r.Chunks[0].Content)
		}
	}

	idx.mu.Lock()
	assert.Equal(t, "api latency", idx.gotReq.Query)
	assert.Equal(t, int64(20), idx.gotReq.Limit)
	idx.mu.Unlock()
	assert.Equal(t, 20, backend.gotLimit)
}

func TestHybridSearch_SemanticQueryOverridesEmbedText(t *testing.T) {
	s, _, emb := newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "cpu", SemanticQuery: "cpu utilization by host",
	})
	require.NoError(t, err)
	require.Len(t, emb.gotIn.Texts, 1)
	assert.Equal(t, "cpu utilization by host", emb.gotIn.Texts[0])
}

func TestHybridSearch_FiltersReachBothLegs(t *testing.T) {
	backend := &fakeVectorBackend{}
	s, idx, _ := newHybridTestServer(lexTableResponse(), backend)
	s.collectionAllowlist = vector.NewCollectionAllowlist([]string{"g/dashboards"}, nil)

	key := validKey()
	key.Resource = "dashboards"
	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: key, Query: "q",
		Filters: []*resourcepb.Requirement{
			{Key: "uid", Operator: "in", Values: []string{"u1"}},
			{Key: "folder", Operator: "in", Values: []string{"f1"}},
			{Key: "datasource_uid", Operator: "in", Values: []string{"ds1"}},
			{Key: "language", Operator: "in", Values: []string{"promql"}},
		},
	})
	require.NoError(t, err)

	idx.mu.Lock()
	require.Len(t, idx.gotReq.Options.Fields, 4)
	assert.Equal(t, SEARCH_FIELD_NAME, idx.gotReq.Options.Fields[0].Key)
	assert.Equal(t, SEARCH_FIELD_FOLDER, idx.gotReq.Options.Fields[1].Key)
	assert.Equal(t, "reference.DataSource", idx.gotReq.Options.Fields[2].Key)
	assert.Equal(t, SEARCH_FIELD_PREFIX+"ds_types", idx.gotReq.Options.Fields[3].Key)
	assert.Equal(t, languageToDSTypes["promql"], idx.gotReq.Options.Fields[3].Values)
	assert.Contains(t, idx.gotReq.Options.Fields[3].Values, "prometheus")
	idx.mu.Unlock()

	require.Len(t, backend.gotFilters, 4)
	assert.Equal(t, "uid", backend.gotFilters[0].Field)
	assert.Equal(t, "folder", backend.gotFilters[1].Field)
	assert.Equal(t, "datasourceUid", backend.gotFilters[2].Field)
	assert.Equal(t, vector.SearchFilter{Field: "language", Values: []string{"promql"}}, backend.gotFilters[3])
}

func TestHybridSearch_SemanticAuthzDenied(t *testing.T) {
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{
			{UID: "denied", Title: "Denied", Score: 0.1, Folder: "f1"},
		},
	}
	s, _, _ := newHybridTestServer(lexTableResponse(), backend, authlib.FixedAccessClient(false))

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	assert.Empty(t, resp.Results)
}

func TestHybridSearch_LimitTruncates(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"a", "A", "f"}, [3]string{"b", "B", "f"}, [3]string{"c", "C", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", Limit: 2,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "a", resp.Results[0].Key.Name)
}

func TestHybridSearch_NotConfigured(t *testing.T) {
	s := newTestSearchServer(nil, nil)
	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "q"})
	require.Error(t, err)
	assert.Equal(t, codes.Unimplemented, status.Code(err))
}

func TestHybridSearch_ValidationErrorsAreInvalidArgument(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Query: "q"})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))

	_, err = s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
		Filters: []*resourcepb.Requirement{{Key: "tags", Operator: "in", Values: []string{"x"}}},
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestHybridSearch_LexicalLegFailureFailsRequest(t *testing.T) {
	backend := &fakeVectorBackend{}
	s, idx, _ := newHybridTestServer(lexTableResponse(), backend)
	idx.err = fmt.Errorf("index exploded")

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

func TestHybridSearch_LexicalErrorCodes(t *testing.T) {
	// Embedded codes with retry semantics survive; anything else is a server
	// fault for a server-built request. Both ways the lexical leg reports an
	// ErrorResult must yield the same code.
	cases := map[int32]codes.Code{
		http.StatusServiceUnavailable:  codes.Unavailable,
		http.StatusTooManyRequests:     codes.ResourceExhausted,
		http.StatusBadRequest:          codes.Internal,
		http.StatusInternalServerError: codes.Internal,
	}

	// The wrapper status is deliberately one that would win status.Code if the
	// details result were merged with it instead of replacing it — that is how
	// a server-built request's own 400 used to reach the caller as
	// InvalidArgument.
	forms := map[string]func(*testing.T, int32) *hybridFakeIndex{
		"response-embedded": func(_ *testing.T, embedded int32) *hybridFakeIndex {
			return &hybridFakeIndex{resp: &resourcepb.ResourceSearchResponse{
				Error: &resourcepb.ErrorResult{Code: embedded, Message: "lexical failure"},
			}}
		},
		"grpc details": func(t *testing.T, embedded int32) *hybridFakeIndex {
			st, err := status.New(codes.InvalidArgument, "wrapper").WithDetails(
				&resourcepb.ErrorResult{Code: embedded, Message: "lexical failure"},
			)
			require.NoError(t, err)
			return &hybridFakeIndex{err: st.Err()}
		},
	}

	for form, newIndex := range forms {
		for embedded, want := range cases {
			t.Run(fmt.Sprintf("%s/%d", form, embedded), func(t *testing.T) {
				s := newTestSearchServer(newTestEmbedder(&fakeTextEmbedder{dim: 4}), &fakeVectorBackend{})
				s.search = &fakeSearchBackend{idx: newIndex(t, embedded)}

				_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
					Key: validKey(), Query: "q",
				})
				require.Error(t, err)
				assert.Equal(t, want, status.Code(err))
			})
		}
	}
}

// recordingRateLimiter satisfies vector.RateLimiter and records whether it
// was consulted.
type recordingRateLimiter struct {
	called bool
}

func (r *recordingRateLimiter) Allow(context.Context, string, time.Duration, int) (bool, int64, error) {
	r.called = true
	return true, 1, nil
}

func (r *recordingRateLimiter) SweepOlderThan(context.Context, time.Time) (int64, error) {
	return 0, nil
}

func TestHybridSearch_CollectionResolution(t *testing.T) {
	t.Run("unprovisioned collection is NotFound before embedding", func(t *testing.T) {
		emb := &fakeTextEmbedder{dim: 4}
		backend := &fakeVectorBackend{resolveNotFound: true}
		s, _, _ := newHybridTestServer(lexTableResponse(), backend)
		s.embedder = newTestEmbedder(emb)

		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Key: validKey(), Query: "q",
		})
		require.Error(t, err)
		assert.Equal(t, codes.NotFound, status.Code(err))
		assert.Empty(t, emb.gotIn.Texts, "must not spend an embedding on an unprovisioned collection")
	})

	t.Run("disallowed collection is NotFound, same as unprovisioned", func(t *testing.T) {
		s, _, _ := newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})
		s.collectionAllowlist = vector.NewCollectionAllowlist(nil, nil)

		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Key: validKey(), Query: "q",
		})
		require.Error(t, err)
		assert.Equal(t, codes.NotFound, status.Code(err))
	})

	t.Run("external collections are rejected", func(t *testing.T) {
		backend := &fakeVectorBackend{
			collection: &vector.Collection{Group: "g", Resource: "r", PartitionKey: "r", IsExternal: true},
		}
		s, _, _ := newHybridTestServer(lexTableResponse(), backend)

		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Key: validKey(), Query: "q",
		})
		require.Error(t, err)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("semantic leg searches the resolved partition key", func(t *testing.T) {
		backend := &fakeVectorBackend{
			collection: &vector.Collection{Group: "g", Resource: "r", PartitionKey: "custom_partition"},
		}
		s, _, _ := newHybridTestServer(lexTableResponse(), backend)

		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Key: validKey(), Query: "q",
		})
		require.NoError(t, err)
		assert.Equal(t, "custom_partition", backend.gotResource)
	})
}

func TestHybridSearch_NamespaceMismatchIsForbidden(t *testing.T) {
	// A caller authenticated for one namespace must not burn another
	// tenant's rate budget or embed quota.
	limiter := &recordingRateLimiter{}
	emb := &fakeTextEmbedder{dim: 4}
	s, _, _ := newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})
	s.embedder = newTestEmbedder(emb)
	s.rateLimiter = limiter
	s.rateLimitPerTenant = 100
	s.rateLimitWindow = time.Minute

	ctx := authlib.WithAuthInfo(context.Background(),
		&identity.StaticRequester{UserID: 1, UserUID: "u", Namespace: "other-tenant", Type: authlib.TypeUser},
	)
	_, err := s.HybridSearch(ctx, &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.PermissionDenied, status.Code(err))
	assert.False(t, limiter.called, "cross-tenant request must not consume rate budget")
	assert.Empty(t, emb.gotIn.Texts, "cross-tenant request must not consume embed quota")
}

func TestHybridSearch_UnauthenticatedDoesNotConsumeRateBudget(t *testing.T) {
	limiter := &recordingRateLimiter{}
	s, _, _ := newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})
	s.rateLimiter = limiter
	s.rateLimitPerTenant = 100
	s.rateLimitWindow = time.Minute

	_, err := s.HybridSearch(context.Background(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Unauthenticated, status.Code(err))
	assert.False(t, limiter.called, "unauthenticated request must not consume rate budget")
}

func TestHybridSearch_CallerCancellationReturnsCanceled(t *testing.T) {
	// A canceled caller context maps to Canceled regardless of which leg
	// failed or how it wrapped the error.
	backend := &fakeVectorBackend{err: fmt.Errorf("pgvector: %w", context.Canceled)}
	s, idx, _ := newHybridTestServer(lexTableResponse(), backend)
	idx.err = fmt.Errorf("bleve: %w", context.Canceled)

	_, err := s.HybridSearch(canceledAuthedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Canceled, status.Code(err))
}

func TestHybridSearch_DownstreamCanceledWithLiveContextReturnsInternal(t *testing.T) {
	// A downstream cancellation while the caller is still live is a
	// server-side fault, not a client disconnect.
	backend := &fakeVectorBackend{err: fmt.Errorf("pgvector: %w", context.Canceled)}
	s, _, _ := newHybridTestServer(lexTableResponse(), backend)

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

func TestHybridSearch_DownstreamCanceledStatusWithLiveContextReturnsInternal(t *testing.T) {
	// gRPC-backed calls inside a leg surface cancellation as a status
	// error whose code survives %w wrapping — with a live caller it must
	// still classify as Internal, not leak Canceled into the response.
	backend := &fakeVectorBackend{}
	s, idx, _ := newHybridTestServer(lexTableResponse(), backend)
	idx.err = fmt.Errorf("storage list: %w", status.Error(codes.Canceled, "context canceled"))

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

func TestHybridSearch_VectorLegFailureFailsRequest(t *testing.T) {
	backend := &fakeVectorBackend{err: fmt.Errorf("pgvector exploded")}
	s, _, _ := newHybridTestServer(lexTableResponse(), backend)

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

type fakeRerankScorer struct {
	mu       sync.Mutex
	scores   []float64
	err      error
	gotQ     string
	gotTexts []string
	calls    int
}

func (f *fakeRerankScorer) Score(_ context.Context, query string, texts []string) ([]float64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	f.gotQ, f.gotTexts = query, texts
	if f.err != nil {
		return nil, f.err
	}
	if f.scores != nil {
		return f.scores, nil
	}
	out := make([]float64, len(texts))
	return out, nil
}

func rerankTestReranker(s rerank.Scorer, thresholds rerank.RelevanceThresholds) *rerank.Reranker {
	return &rerank.Reranker{Scorer: s, Model: "test/model", Thresholds: thresholds}
}

type cancelingScorer struct{ cancel context.CancelFunc }

func (c *cancelingScorer) Score(ctx context.Context, _ string, _ []string) ([]float64, error) {
	c.cancel()
	return nil, ctx.Err()
}

func TestHybridSearch_RerankReordersAndOverwritesScores(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"first", "First", "f"},
		[3]string{"second", "Second", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	// RRF order: first, second. Rerank flips it.
	scorer := &fakeRerankScorer{scores: []float64{0.1, 0.9}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "second", resp.Results[0].Key.Name)
	assert.Equal(t, 0.9, resp.Results[0].Score)
	assert.Equal(t, "first", resp.Results[1].Key.Name)
	assert.Equal(t, 0.1, resp.Results[1].Score)
	// scorer got the synthesized title chunks as documents, in RRF order
	assert.Equal(t, []string{"First", "Second"}, scorer.gotTexts)
}

func TestHybridSearch_RerankUsesSemanticQueryForScoring(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "short", SemanticQuery: "rich semantic phrasing",
	})
	require.NoError(t, err)
	assert.Equal(t, "rich semantic phrasing", scorer.gotQ)
}

func TestHybridSearch_MinRelevanceDropsBelowThreshold(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"keep", "Keep", "f"},
		[3]string{"drop", "Drop", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{scores: []float64{0.5, 0.05}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{Low: 0.1, High: 0.6})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", MinRelevance: "low",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	assert.Equal(t, "keep", resp.Results[0].Key.Name)

	// "high" (0.6) drops both
	resp, err = s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", MinRelevance: "high",
	})
	require.NoError(t, err)
	assert.Empty(t, resp.Results)
}

func TestHybridSearch_MinRelevanceNoopWhenUncalibrated(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	scorer := &fakeRerankScorer{scores: []float64{0.0001}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{}) // uncalibrated

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", MinRelevance: "highest",
	})
	require.NoError(t, err)
	assert.Len(t, resp.Results, 1)
}

func TestHybridSearch_MinRelevanceNoopWithoutReranker(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	// s.reranker stays nil
	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", MinRelevance: "high",
	})
	require.NoError(t, err)
	assert.Len(t, resp.Results, 1)
	// RRF score preserved
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_SkipRerankBypassesConfiguredReranker(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	scorer := &fakeRerankScorer{scores: []float64{0.9}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{Low: 0.1})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", SkipRerank: true,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	assert.Equal(t, 0, scorer.calls, "scorer must not be called when skip_rerank is set")
	// RRF score preserved, not the scorer's 0.9
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_ResolvesFolderTitlesInOneBatchedLookup(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"d1", "Dash One", "f1"},
		[3]string{"d2", "Dash Two", "f2"},
		[3]string{"d3", "Dash Three", "f1"}, // duplicate folder: must not repeat in the lookup
	)
	s, idx, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	idx.folderResp = lexTableResponse(
		[3]string{"f1", "Folder One", ""},
		[3]string{"f2", "Folder Two", ""},
	)

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 3)
	titles := map[string]string{}
	for _, r := range resp.Results {
		titles[r.Key.Name] = r.FolderTitle
	}
	assert.Equal(t, map[string]string{"d1": "Folder One", "d2": "Folder Two", "d3": "Folder One"}, titles)

	// exactly one folders request, distinct uids only, against the folder index
	idx.mu.Lock()
	defer idx.mu.Unlock()
	require.NotNil(t, idx.gotFolderReq)
	assert.Equal(t, "folder.grafana.app", idx.gotFolderReq.Options.Key.Group)
	require.Len(t, idx.gotFolderReq.Options.Fields, 1)
	assert.ElementsMatch(t, []string{"f1", "f2"}, idx.gotFolderReq.Options.Fields[0].Values)
	// lexical-leg request assertions stay untouched by the folder lookup
	assert.Equal(t, "q", idx.gotReq.Query)
}

func TestHybridSearch_RootFolderSkipsTitleLookup(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"d1", "Dash One", ""},
		[3]string{"d2", "Dash Two", "general"},
	)
	s, idx, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
	for _, r := range resp.Results {
		assert.Empty(t, r.FolderTitle)
	}
	idx.mu.Lock()
	defer idx.mu.Unlock()
	assert.Nil(t, idx.gotFolderReq, "no folders lookup for root-only results")
}

func TestHybridSearch_FolderTitleResolutionFailsOpen(t *testing.T) {
	for name, setup := range map[string]func(*hybridFakeIndex){
		"transport error": func(idx *hybridFakeIndex) {
			idx.folderErr = errors.New("folder index exploded")
		},
		"payload-embedded error": func(idx *hybridFakeIndex) {
			idx.folderResp = &resourcepb.ResourceSearchResponse{
				Error: &resourcepb.ErrorResult{Message: "index building", Code: 503},
			}
		},
	} {
		t.Run(name, func(t *testing.T) {
			lexResp := lexTableResponse([3]string{"d1", "Dash One", "f1"})
			s, idx, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
			setup(idx)

			resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
				Key: validKey(), Query: "q",
			})
			require.NoError(t, err, "title resolution is display sugar; it must never fail the search")
			require.Len(t, resp.Results, 1)
			assert.Empty(t, resp.Results[0].FolderTitle)
			assert.Equal(t, "f1", resp.Results[0].Folder, "folder uid still returned")
		})
	}
}

func TestHybridSearch_ResolvesManagedByForSemanticOnlyHits(t *testing.T) {
	lexResp := lexTableResponse([3]string{"lexonly", "Lex Only", "f1"})
	backend := &fakeVectorBackend{
		results: []vector.VectorSearchResult{
			{UID: "semonly", Title: "Sem Only", Subresource: "panel/1", Content: "s1", Score: 0.1},
		},
	}
	s, idx, _ := newHybridTestServer(lexResp, backend)
	idx.managedByResp = managerTableResponse([3]string{"semonly", "repo", "m1"})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)

	managed := map[string][2]string{}
	for _, r := range resp.Results {
		managed[r.Key.Name] = [2]string{r.ManagedByKind, r.ManagedById}
	}
	assert.Equal(t, [2]string{"", ""}, managed["lexonly"])
	assert.Equal(t, [2]string{"repo", "m1"}, managed["semonly"])

	idx.mu.Lock()
	defer idx.mu.Unlock()
	require.NotNil(t, idx.gotManagedByReq)
	require.Len(t, idx.gotManagedByReq.Options.Fields, 1)
	assert.Equal(t, []string{"semonly"}, idx.gotManagedByReq.Options.Fields[0].Values, "only the semantic-only uid is looked up")
	assert.Equal(t, "q", idx.gotReq.Query, "lexical-leg request assertions stay untouched by the managed-by lookup")
}

func TestHybridSearch_SkipsManagedByLookupWhenNoSemanticOnlyHits(t *testing.T) {
	lexResp := lexTableResponse([3]string{"d1", "Dash One", "f1"})
	s, idx, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)

	idx.mu.Lock()
	defer idx.mu.Unlock()
	assert.Nil(t, idx.gotManagedByReq, "no semantic-only hits: nothing to resolve")
}

func TestHybridSearch_ManagedByResolutionFailsOpen(t *testing.T) {
	for name, setup := range map[string]func(*hybridFakeIndex){
		"transport error": func(idx *hybridFakeIndex) {
			idx.managedByErr = errors.New("index exploded")
		},
		"payload-embedded error": func(idx *hybridFakeIndex) {
			idx.managedByResp = &resourcepb.ResourceSearchResponse{
				Error: &resourcepb.ErrorResult{Message: "index building", Code: 503},
			}
		},
	} {
		t.Run(name, func(t *testing.T) {
			backend := &fakeVectorBackend{
				results: []vector.VectorSearchResult{
					{UID: "semonly", Title: "Sem Only", Subresource: "panel/1", Content: "s1", Score: 0.1},
				},
			}
			s, idx, _ := newHybridTestServer(lexTableResponse(), backend)
			setup(idx)

			resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
				Key: validKey(), Query: "q",
			})
			require.NoError(t, err, "managed-by resolution is display sugar; it must never fail the search")
			require.Len(t, resp.Results, 1)
			assert.Empty(t, resp.Results[0].ManagedByKind)
			assert.Empty(t, resp.Results[0].ManagedById)
		})
	}
}

func TestHybridSearch_RerankFailureFallsBackToRRFOrder(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"first", "First", "f"},
		[3]string{"second", "Second", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{err: errors.New("provider exploded")}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{Low: 0.1})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", MinRelevance: "low",
	})
	require.NoError(t, err)
	// fail-open: RRF ordering, nothing dropped
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "first", resp.Results[0].Key.Name)
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_RerankTimeoutFallsBack(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	scorer := &fakeRerankScorer{err: rerank.ErrCallTimeout}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	assert.Len(t, resp.Results, 1)
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_RerankScoreLengthMismatchFallsBack(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"first", "First", "f"},
		[3]string{"second", "Second", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{scores: []float64{0.9}} // 1 score for 2 results
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "first", resp.Results[0].Key.Name)
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

func TestHybridSearch_RerankRunsBeforeLimitTruncation(t *testing.T) {
	// 3 candidates, limit 2. RRF rank 3 gets the best rerank score and
	// must appear in the final top-2 — proving rerank happens pre-truncation.
	lexResp := lexTableResponse(
		[3]string{"r1", "R1", "f"},
		[3]string{"r2", "R2", "f"},
		[3]string{"r3", "R3", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{scores: []float64{0.1, 0.2, 0.9}}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", Limit: 2,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
	assert.Equal(t, "r3", resp.Results[0].Key.Name)
	assert.Equal(t, "r2", resp.Results[1].Key.Name)
}

func TestHybridSearch_RerankCallerCancellationPropagates(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse([3]string{"a", "A", "f"}), &fakeVectorBackend{})
	ctx, cancel := context.WithCancel(authedCtx())
	scorer := &cancelingScorer{cancel: cancel}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	_, err := s.HybridSearch(ctx, &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Canceled, status.Code(err))
}

func TestHybridSearch_RerankPoolTruncatedToMaxCandidates(t *testing.T) {
	// 200 lexical + 150 disjoint semantic hits fuse into 350 candidates —
	// past the Vertex 200-record cap — so the scorer must only ever see
	// maxRerankCandidates texts.
	rows := make([][3]string, 200)
	for i := 0; i < 200; i++ {
		rows[i] = [3]string{fmt.Sprintf("lex-%03d", i), fmt.Sprintf("Lex %03d", i), "f"}
	}
	lexResp := lexTableResponse(rows...)

	sem := make([]vector.VectorSearchResult, 150)
	for i := 0; i < 150; i++ {
		sem[i] = vector.VectorSearchResult{
			UID: fmt.Sprintf("sem-%03d", i), Title: fmt.Sprintf("Sem %03d", i),
			Content: "c", Score: float64(i), Folder: "f",
		}
	}
	backend := &fakeVectorBackend{results: sem}

	s, _, _ := newHybridTestServer(lexResp, backend)
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", Limit: 200,
	})
	require.NoError(t, err)
	assert.Len(t, scorer.gotTexts, maxRerankCandidates)
	assert.Len(t, resp.Results, maxRerankCandidates)
}

func TestHybridSearch_RerankFallbackThenLimitTruncates(t *testing.T) {
	lexResp := lexTableResponse(
		[3]string{"first", "First", "f"},
		[3]string{"second", "Second", "f"},
	)
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{err: errors.New("provider exploded")}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q", Limit: 1,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	// fail-open RRF order, then limit truncation keeps rank-1
	assert.Equal(t, "first", resp.Results[0].Key.Name)
	assert.InDelta(t, 1.0/61, resp.Results[0].Score, 1e-12)
}

type fakeLexicalSearcher struct {
	mu     sync.Mutex
	called bool
	gotQ   vector.LexicalQuery
	hits   []vector.LexicalHit
	err    error
}

func (f *fakeLexicalSearcher) LexicalSearch(_ context.Context, q vector.LexicalQuery) ([]vector.LexicalHit, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.called = true
	f.gotQ = q
	return f.hits, f.err
}

func externalBackend(results ...vector.VectorSearchResult) *fakeVectorBackend {
	return &fakeVectorBackend{
		collection: &vector.Collection{Group: "g", Resource: "r", PartitionKey: "r_external", IsExternal: true},
		results:    results,
	}
}

func TestHybridSearch_ExternalFusesBothLegs(t *testing.T) {
	backend := externalBackend(
		vector.VectorSearchResult{UID: "both", Title: "Both Legs", Subresource: "chunk/1", Content: "b1", Score: 0.1},
		vector.VectorSearchResult{UID: "semonly", Title: "Sem Only", Subresource: "chunk/0", Content: "s0", Score: 0.2},
	)
	lexical := &fakeLexicalSearcher{hits: []vector.LexicalHit{
		{UID: "both", Title: "Both Legs", Subresource: "chunk/1", Content: "b1"},
		{UID: "lexonly", Title: "Lex Only", Subresource: "chunk/2", Content: "stored chunk text", Metadata: []byte(`{"kind":"alert_rule"}`)},
	}}
	s, idx, _ := newHybridTestServer(lexTableResponse(), backend)
	s.externalLexical = lexical

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "api latency", Limit: 10,
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 3)

	assert.Equal(t, "both", resp.Results[0].Key.Name)
	assert.InDelta(t, 1.0/61+1.0/61, resp.Results[0].Score, 1e-12)

	// Lexical-only hits carry their stored chunk, not a synthesized title.
	for _, r := range resp.Results {
		if r.Key.Name == "lexonly" {
			require.Len(t, r.Chunks, 1)
			assert.Equal(t, "chunk/2", r.Chunks[0].Subresource)
			assert.Equal(t, "stored chunk text", r.Chunks[0].Content)
			assert.Equal(t, []byte(`{"kind":"alert_rule"}`), r.Chunks[0].Metadata)
		}
	}

	lexical.mu.Lock()
	assert.Equal(t, "ns", lexical.gotQ.Namespace)
	assert.Equal(t, s.embedder.Model, lexical.gotQ.Model)
	assert.Equal(t, "r_external", lexical.gotQ.Resource)
	assert.Equal(t, "api latency", lexical.gotQ.Query)
	assert.Equal(t, 20, lexical.gotQ.Limit)
	lexical.mu.Unlock()

	// External must never touch bleve.
	idx.mu.Lock()
	assert.Nil(t, idx.gotReq)
	assert.Nil(t, idx.gotFolderReq)
	assert.Nil(t, idx.gotManagedByReq)
	idx.mu.Unlock()
}

func TestHybridSearch_ExternalResolvesFolderTitles(t *testing.T) {
	// External rows can carry folder uids; folder titles resolve like any
	// other kind. managedBy stays skipped (no bleve index for the kind).
	backend := externalBackend(
		vector.VectorSearchResult{UID: "u1", Title: "T1", Subresource: "chunk/0", Content: "c1", Score: 0.1, Folder: "f1"},
	)
	s, idx, _ := newHybridTestServer(lexTableResponse(), backend)
	s.externalLexical = &fakeLexicalSearcher{}
	idx.folderResp = lexTableResponse([3]string{"f1", "Folder One", ""})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	assert.Equal(t, "Folder One", resp.Results[0].FolderTitle)

	idx.mu.Lock()
	assert.NotNil(t, idx.gotFolderReq)
	assert.Nil(t, idx.gotReq, "lexical leg must not touch bleve")
	assert.Nil(t, idx.gotManagedByReq, "managedBy must not touch bleve")
	idx.mu.Unlock()
}

func TestHybridSearch_ExternalDualLegHitKeepsLexicalChunk(t *testing.T) {
	// The lexical-matched chunk may not be among the semantic leg's
	// retained chunks; it must still ship (deduped by subresource) so the
	// text that produced the match reaches the caller.
	backend := externalBackend(
		vector.VectorSearchResult{UID: "both", Title: "T", Subresource: "chunk/0", Content: "semantic text", Score: 0.1},
		vector.VectorSearchResult{UID: "same", Title: "S", Subresource: "chunk/0", Content: "shared", Score: 0.2},
	)
	lexical := &fakeLexicalSearcher{hits: []vector.LexicalHit{
		{UID: "both", Title: "T", Subresource: "chunk/7", Content: "exact keyword text"},
		{UID: "same", Title: "S", Subresource: "chunk/0", Content: "shared"},
	}}
	s, _, _ := newHybridTestServer(lexTableResponse(), backend)
	s.externalLexical = lexical

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)

	for _, r := range resp.Results {
		switch r.Key.Name {
		case "both":
			// Semantic chunks first (rerank input unchanged), lexical appended.
			require.Len(t, r.Chunks, 2)
			assert.Equal(t, "chunk/0", r.Chunks[0].Subresource)
			assert.Equal(t, "chunk/7", r.Chunks[1].Subresource)
			assert.Equal(t, "exact keyword text", r.Chunks[1].Content)
		case "same":
			// Same subresource on both legs: no duplicate.
			require.Len(t, r.Chunks, 1)
		}
	}
}

func TestHybridSearch_ExternalAuthzFiltersBothLegs(t *testing.T) {
	// Each leg authz-filters its own hits, so a deny-all client drops
	// lexical-only hits too, not just the semantic leg's rows.
	backend := externalBackend(
		vector.VectorSearchResult{UID: "u1", Title: "T1", Subresource: "chunk/0", Content: "c1", Score: 0.1},
	)
	lexical := &fakeLexicalSearcher{hits: []vector.LexicalHit{
		{UID: "lexonly", Title: "Lex Only", Subresource: "chunk/0", Content: "c"},
	}}
	s, _, _ := newHybridTestServer(lexTableResponse(), backend, authlib.FixedAccessClient(false))
	s.externalLexical = lexical

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	assert.Empty(t, resp.Results)

	// Allow-all keeps both.
	s, _, _ = newHybridTestServer(lexTableResponse(), backend)
	s.externalLexical = lexical
	resp, err = s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 2)
}

func TestHybridSearch_ExternalWithoutSearcherStaysRejected(t *testing.T) {
	// No searcher wired (non-postgres backends) keeps the old rejection.
	s, _, _ := newHybridTestServer(lexTableResponse(), externalBackend())
	s.externalLexical = nil

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestHybridSearch_ExternalLexicalLegFailureFailsRequest(t *testing.T) {
	s, _, _ := newHybridTestServer(lexTableResponse(), externalBackend())
	s.externalLexical = &fakeLexicalSearcher{err: fmt.Errorf("fts exploded")}

	_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.Error(t, err)
	assert.Equal(t, codes.Internal, status.Code(err))
}

func TestHybridSearch_ExternalEmptyLexicalLegIsSemanticOnly(t *testing.T) {
	backend := externalBackend(
		vector.VectorSearchResult{UID: "u1", Title: "T1", Subresource: "chunk/0", Content: "c1", Score: 0.1},
	)
	s, _, _ := newHybridTestServer(lexTableResponse(), backend)
	s.externalLexical = &fakeLexicalSearcher{}

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
}

func TestHybridSearch_ExternalFilters(t *testing.T) {
	t.Run("metadata keys reach both legs verbatim", func(t *testing.T) {
		backend := externalBackend()
		lexical := &fakeLexicalSearcher{}
		s, _, _ := newHybridTestServer(lexTableResponse(), backend)
		s.externalLexical = lexical

		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Key: validKey(), Query: "q",
			Filters: []*resourcepb.Requirement{
				{Key: "uid", Operator: "in", Values: []string{"u1"}},
				{Key: "folderUid", Operator: "in", Values: []string{"f1", "f2"}},
				{Key: "kind", Operator: "in", Values: []string{"alert_rule"}},
			},
		})
		require.NoError(t, err)

		want := []vector.SearchFilter{
			{Field: "uid", Values: []string{"u1"}},
			{Field: "folderUid", Values: []string{"f1", "f2"}},
			{Field: "kind", Values: []string{"alert_rule"}},
		}
		assert.Equal(t, want, backend.gotFilters)
		lexical.mu.Lock()
		assert.Equal(t, want, lexical.gotQ.Filters)
		lexical.mu.Unlock()
	})

	t.Run("folder key reaches both legs as a column filter", func(t *testing.T) {
		backend := externalBackend()
		lexical := &fakeLexicalSearcher{}
		s, _, _ := newHybridTestServer(lexTableResponse(), backend)
		s.externalLexical = lexical

		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Key: validKey(), Query: "q",
			Filters: []*resourcepb.Requirement{{Key: "folder", Operator: "in", Values: []string{"f1"}}},
		})
		require.NoError(t, err)

		want := []vector.SearchFilter{{Field: "folder", Values: []string{"f1"}}}
		assert.Equal(t, want, backend.gotFilters)
		lexical.mu.Lock()
		assert.Equal(t, want, lexical.gotQ.Filters)
		lexical.mu.Unlock()
	})

	t.Run("too many filter values rejected on both kinds", func(t *testing.T) {
		values := make([]string, maxFilterValues+1)
		for i := range values {
			values[i] = fmt.Sprintf("v%d", i)
		}

		s, _, _ := newHybridTestServer(lexTableResponse(), externalBackend())
		s.externalLexical = &fakeLexicalSearcher{}
		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Key: validKey(), Query: "q",
			Filters: []*resourcepb.Requirement{{Key: "labels", Operator: "in", Values: values}},
		})
		require.Error(t, err)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))

		// Cap is universal — internal hits the same parameter limit.
		s, _, _ = newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})
		_, err = s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Key: validKey(), Query: "q",
			Filters: []*resourcepb.Requirement{{Key: "uid", Operator: "in", Values: values}},
		})
		require.Error(t, err)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("invalid filter key does not consume rate budget", func(t *testing.T) {
		limiter := &recordingRateLimiter{}
		s, _, _ := newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})
		s.rateLimiter = limiter
		s.rateLimitPerTenant = 100
		s.rateLimitWindow = time.Minute

		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Key: validKey(), Query: "q",
			Filters: []*resourcepb.Requirement{{Key: "tags", Operator: "in", Values: []string{"prod"}}},
		})
		require.Error(t, err)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
		assert.False(t, limiter.called, "invalid-filter request must not consume rate budget")
	})

	t.Run("internal collections keep the closed allowlist", func(t *testing.T) {
		s, _, _ := newHybridTestServer(lexTableResponse(), &fakeVectorBackend{})
		s.externalLexical = &fakeLexicalSearcher{}

		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Key: validKey(), Query: "q",
			Filters: []*resourcepb.Requirement{{Key: "folderUid", Operator: "in", Values: []string{"f1"}}},
		})
		require.Error(t, err)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
	})
}

func TestHybridSearch_RerankSubstitutesNameForEmptyTitle(t *testing.T) {
	lexResp := lexTableResponse([3]string{"noname", "", "f"})
	s, _, _ := newHybridTestServer(lexResp, &fakeVectorBackend{})
	scorer := &fakeRerankScorer{}
	s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})

	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
		Key: validKey(), Query: "q",
	})
	require.NoError(t, err)
	require.Len(t, resp.Results, 1)
	require.Len(t, scorer.gotTexts, 1)
	// an empty title synthesizes an empty chunk; the resource name is the
	// only text left to score with, instead of a 400-inducing empty doc.
	assert.Equal(t, "noname", scorer.gotTexts[0])
}
