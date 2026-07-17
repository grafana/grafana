package resource

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

func hybridKey() *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: "ns", Group: "g", Resource: "r"}
}

func TestFuseRRF_OverlapRanksHighest(t *testing.T) {
	lex := []lexicalHit{
		{uid: "a", title: "A", folder: "f1"},
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

func TestLexicalHitsFromResponse(t *testing.T) {
	hits := lexicalHitsFromResponse(lexTableResponse(
		[3]string{"u1", "Title One", "f1"},
		[3]string{"u2", "Title Two", "f2"},
	))
	require.Len(t, hits, 2)
	assert.Equal(t, lexicalHit{uid: "u1", title: "Title One", folder: "f1"}, hits[0])
	assert.Equal(t, lexicalHit{uid: "u2", title: "Title Two", folder: "f2"}, hits[1])
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

	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "tags", Operator: "in", Values: []string{"prod"}}}
	resp := validateHybridSearchRequest(r)
	require.NotNil(t, resp)
	assert.Contains(t, resp.Error.Message, "tags")

	r = valid()
	r.Filters = []*resourcepb.Requirement{{Key: "uid", Operator: "in"}}
	require.NotNil(t, validateHybridSearchRequest(r)) // no values

	r = valid()
	r.Filters = []*resourcepb.Requirement{
		{Key: "uid", Operator: "in", Values: []string{"u"}},
		{Key: "folder", Operator: "in", Values: []string{"f"}},
		{Key: "datasource_uid", Operator: "in", Values: []string{"d"}},
		{Key: "language", Operator: "in", Values: []string{"promql"}},
	}
	assert.Nil(t, validateHybridSearchRequest(r))
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
	assert.Equal(t, []string{SEARCH_FIELD_TITLE, SEARCH_FIELD_FOLDER}, out.Fields)

	require.Len(t, out.Options.Fields, 4)
	assert.Equal(t, SEARCH_FIELD_NAME, out.Options.Fields[0].Key)
	assert.Equal(t, []string{"u1"}, out.Options.Fields[0].Values)
	assert.Equal(t, SEARCH_FIELD_FOLDER, out.Options.Fields[1].Key)
	assert.Equal(t, "reference.DataSource", out.Options.Fields[2].Key)
	assert.Equal(t, []string{"ds1"}, out.Options.Fields[2].Values)
	assert.Equal(t, "ds_types", out.Options.Fields[3].Key)
	assert.ElementsMatch(t, []string{"prometheus", "loki"}, out.Options.Fields[3].Values)
}

func TestHybridLexicalRequest_UnknownLanguageAddsNoRequirement(t *testing.T) {
	req := &resourcepb.HybridSearchRequest{
		Key:   hybridKey(),
		Query: "q",
		Filters: []*resourcepb.Requirement{
			{Key: "language", Operator: "in", Values: []string{"cypher"}},
		},
	}
	out := hybridLexicalRequest(req, 10)
	assert.Empty(t, out.Options.Fields)
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

func TestHybridFetchDepth(t *testing.T) {
	assert.Equal(t, 20, hybridFetchDepth(10))
	assert.Equal(t, 200, hybridFetchDepth(150))
}
