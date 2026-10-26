package resource

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

func TestHybridSearch_LexicalHitRerankText(t *testing.T) {
	for _, tt := range []struct {
		name       string
		semantic   bool
		legacy     bool
		skipRerank bool
		noReranker bool
		wantText   string
	}{
		{name: "lexical only", wantText: "Overview\nDatabase operations\nUnrelated message\nRequests timeout during peak traffic\nInvestigating DATABASE connection failures"},
		{name: "both legs", semantic: true, wantText: "Semantic context\nOverview\nDatabase operations\nUnrelated message\nRequests timeout during peak traffic\nInvestigating DATABASE connection failures"},
		{name: "legacy response falls back to title", legacy: true, wantText: "Overview"},
		{name: "skip rerank", skipRerank: true},
		{name: "no reranker", noReranker: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			lexResp := lexFieldValueResponse([3]string{"a", "Overview", ""})
			lexResp.Fields = append(lexResp.Fields,
				&resourcepb.ResourceSearchField{Name: "summary", Type: resourcepb.ResourceSearchField_STRING},
				&resourcepb.ResourceSearchField{Name: "messages", Type: resourcepb.ResourceSearchField_STRING, IsArray: true},
				&resourcepb.ResourceSearchField{Name: SEARCH_FIELD_DESCRIPTION, Type: resourcepb.ResourceSearchField_STRING},
				&resourcepb.ResourceSearchField{Name: SEARCH_FIELD_MANAGER_KIND, Type: resourcepb.ResourceSearchField_STRING},
				&resourcepb.ResourceSearchField{Name: SEARCH_FIELD_MANAGER_ID, Type: resourcepb.ResourceSearchField_STRING},
			)
			lexResp.Rows[0].Values = append(lexResp.Rows[0].Values,
				&resourcepb.ResourceSearchValue{FieldIndex: 2, StringValues: []string{"Investigating DATABASE connection failures"}},
				&resourcepb.ResourceSearchValue{FieldIndex: 3, StringValues: []string{"Unrelated message", "Requests timeout during peak traffic", "Requests timeout during peak traffic"}},
				&resourcepb.ResourceSearchValue{FieldIndex: 4, StringValues: []string{"Database operations"}},
				&resourcepb.ResourceSearchValue{FieldIndex: 5, StringValues: []string{"provisioning"}},
				&resourcepb.ResourceSearchValue{FieldIndex: 6, StringValues: []string{"repository-1"}},
			)
			if tt.legacy {
				lexResp = lexTableResponse([3]string{"a", "Overview", ""})
			}
			backend := &fakeVectorBackend{}
			if tt.semantic {
				backend.results = []vector.VectorSearchResult{{UID: "a", Content: "Semantic context"}}
			}
			s, idx, _ := newHybridTestServer(lexResp, backend)
			idx.fieldDefinitions = append(StandardSearchFieldDefinitions(),
				SearchFieldDefinition{Name: "summary", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityText, SearchCapabilityRetrieve}},
				SearchFieldDefinition{Name: "category", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityRetrieve}},
				SearchFieldDefinition{Name: "unstored", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityText}},
				SearchFieldDefinition{Name: "messages", Type: SearchFieldTypeString, Array: true, Capabilities: []SearchCapability{SearchCapabilityText, SearchCapabilityRetrieve}},
			)
			scorer := &fakeRerankScorer{}
			if !tt.noReranker {
				s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})
			}
			resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
				Key: validKey(), Query: "unmatched", SemanticQuery: "Different semantic wording", SkipRerank: tt.skipRerank,
			})
			require.NoError(t, err)
			require.Len(t, resp.Results, 1)
			assert.ElementsMatch(t, []*resourcepb.ResourceSearchRequest_QueryField{
				{Name: SEARCH_FIELD_TITLE, Boost: 1},
				{Name: SEARCH_FIELD_DESCRIPTION, Boost: 1},
				{Name: "summary", Boost: 1},
				{Name: "unstored", Boost: 1},
				{Name: "messages", Boost: 1},
			}, idx.gotReq.QueryFields)
			if tt.skipRerank || tt.noReranker {
				assert.Zero(t, scorer.calls)
				assert.NotContains(t, idx.gotReq.Fields, "summary")
				assert.NotContains(t, idx.gotReq.Fields, "messages")
			} else {
				assert.Equal(t, []string{tt.wantText}, scorer.gotTexts)
				assert.Equal(t, "Different semantic wording", scorer.gotQ)
				assert.ElementsMatch(t, []string{SEARCH_FIELD_TITLE, SEARCH_FIELD_FOLDER, SEARCH_FIELD_MANAGER_KIND, SEARCH_FIELD_MANAGER_ID, SEARCH_FIELD_TAGS, SEARCH_FIELD_DESCRIPTION, "summary", "messages"}, idx.gotReq.Fields)
			}
			if tt.legacy {
				assert.Nil(t, resp.Results[0].Lexical)
			} else {
				wantLexical, err := structpb.NewStruct(map[string]any{
					SEARCH_FIELD_TITLE:        "Overview",
					SEARCH_FIELD_DESCRIPTION:  "Database operations",
					SEARCH_FIELD_MANAGER_KIND: "provisioning",
					SEARCH_FIELD_MANAGER_ID:   "repository-1",
					"summary":                 "Investigating DATABASE connection failures",
					"messages":                []any{"Unrelated message", "Requests timeout during peak traffic", "Requests timeout during peak traffic"},
				})
				require.NoError(t, err)
				assert.Equal(t, wantLexical.Fields, resp.Results[0].Lexical)
			}
			require.Len(t, resp.Results[0].Chunks, 1)
			if tt.semantic {
				assert.Equal(t, "Semantic context", resp.Results[0].Chunks[0].Content)
			} else {
				assert.Equal(t, "Overview", resp.Results[0].Chunks[0].Content)
			}
		})
	}
}

func TestLexicalRerankText(t *testing.T) {
	t.Run("includes title first then sorted text fields and omits metadata", func(t *testing.T) {
		hit, err := structpb.NewStruct(map[string]any{
			SEARCH_FIELD_TITLE:        "Overview",
			SEARCH_FIELD_FOLDER:       "folder-1",
			SEARCH_FIELD_MANAGER_KIND: "provisioning",
			SEARCH_FIELD_MANAGER_ID:   "repository-1",
			"messages":                []any{"  Le délai est élevé  ", "Unrelated message", "Unrelated message", "  "},
			"description":             "Service status",
			"summary":                 "Summary",
			"count":                   123,
		})
		require.NoError(t, err)
		text, truncated := lexicalRerankText(hit.Fields)
		assert.Equal(t, "Overview\nService status\nLe délai est élevé\nUnrelated message\nSummary", text)
		assert.False(t, truncated)
	})

	t.Run("bounds all values without splitting UTF-8", func(t *testing.T) {
		values := []any{"Details", strings.Repeat("界", maxLexicalRerankTextBytes)}
		hit, err := structpb.NewStruct(map[string]any{"messages": values})
		require.NoError(t, err)
		text, truncated := lexicalRerankText(hit.Fields)
		assert.True(t, truncated)
		assert.LessOrEqual(t, len(text), maxLexicalRerankTextBytes)
		assert.Greater(t, len(text), maxLexicalRerankTextBytes-utf8.UTFMax)
		assert.True(t, utf8.ValidString(text))
		assert.True(t, strings.HasPrefix(text, "Details\n界"))
		assert.Equal(t, values[1], hit.Fields["messages"].GetListValue().Values[1].GetStringValue())
	})

	for _, tt := range []struct {
		name      string
		suffix    string
		truncated bool
	}{
		{name: "exact fit followed by empty and duplicate values"},
		{name: "exact fit omits later text", suffix: "More text", truncated: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			full := strings.Repeat("x", maxLexicalRerankTextBytes)
			hit, err := structpb.NewStruct(map[string]any{
				SEARCH_FIELD_TITLE:  full,
				SEARCH_FIELD_FOLDER: "folder-1",
				"messages":          []any{full, "", "  ", tt.suffix},
			})
			require.NoError(t, err)
			text, truncated := lexicalRerankText(hit.Fields)
			assert.Equal(t, full, text)
			assert.Equal(t, tt.truncated, truncated)
		})
	}
}

func TestBoundedLexicalFields(t *testing.T) {
	longName := strings.Repeat("x", maxHybridLexicalBytes)
	full := strings.Repeat("x", maxHybridLexicalBytes-len(SEARCH_FIELD_TITLE)-len("Overview")-len("messages"))
	for _, tt := range []struct {
		name      string
		values    map[string]any
		truncated bool
		check     func(*testing.T, map[string]*structpb.Value)
	}{
		{
			name: "preserves nonempty values and duplicates",
			values: map[string]any{
				SEARCH_FIELD_TITLE: "Overview", "description": "", "messages": []string{"", "é", "é"}, "empty": []string{}, "count": 42,
			},
			check: func(t *testing.T, fields map[string]*structpb.Value) {
				want, err := structpb.NewStruct(map[string]any{
					SEARCH_FIELD_TITLE: "Overview", "messages": []any{"é", "é"},
				})
				require.NoError(t, err)
				assert.True(t, proto.Equal(want, &structpb.Struct{Fields: fields}))
			},
		},
		{
			name:      "title precedes an oversized scalar",
			values:    map[string]any{SEARCH_FIELD_TITLE: "Overview", "aaa": strings.Repeat("界", maxHybridLexicalBytes), "zzz": "last"},
			truncated: true,
			check: func(t *testing.T, fields map[string]*structpb.Value) {
				text := fields["aaa"].GetStringValue()
				assert.NotEmpty(t, text)
				assert.Less(t, len(text), maxHybridLexicalBytes)
				assert.True(t, utf8.ValidString(text))
				assert.True(t, strings.HasPrefix(strings.Repeat("界", maxHybridLexicalBytes), text))
				assert.NotContains(t, fields, "zzz")
			},
		},
		{
			name:      "array order and UTF-8 survive truncation",
			values:    map[string]any{SEARCH_FIELD_TITLE: "Overview", "messages": []string{"", "first", strings.Repeat("界", maxHybridLexicalBytes), "last"}},
			truncated: true,
			check: func(t *testing.T, fields map[string]*structpb.Value) {
				values := fields["messages"].GetListValue().GetValues()
				require.Len(t, values, 2)
				assert.Equal(t, "first", values[0].GetStringValue())
				assert.NotEmpty(t, values[1].GetStringValue())
				assert.True(t, utf8.ValidString(values[1].GetStringValue()))
				assert.True(t, strings.HasPrefix(strings.Repeat("界", maxHybridLexicalBytes), values[1].GetStringValue()))
			},
		},
		{
			name:   "empty arrays are omitted",
			values: map[string]any{SEARCH_FIELD_TITLE: "Overview", "messages": make([]string, maxHybridLexicalBytes)},
			check: func(t *testing.T, fields map[string]*structpb.Value) {
				assert.NotContains(t, fields, "messages")
			},
		},
		{
			name:      "field names consume the budget",
			values:    map[string]any{SEARCH_FIELD_TITLE: "Overview", longName: "text"},
			truncated: true,
			check: func(t *testing.T, fields map[string]*structpb.Value) {
				assert.NotContains(t, fields, longName)
			},
		},
		{
			name:   "exact fit followed by empty values and fields",
			values: map[string]any{SEARCH_FIELD_TITLE: "Overview", "messages": []string{full, ""}, "zzz": "", longName: []string{""}},
			check: func(t *testing.T, fields map[string]*structpb.Value) {
				require.Len(t, fields["messages"].GetListValue().Values, 1)
				assert.Equal(t, full, fields["messages"].GetListValue().Values[0].GetStringValue())
			},
		},
		{
			name:      "exact fit omits a later array value",
			values:    map[string]any{SEARCH_FIELD_TITLE: "Overview", "messages": []string{full, "", "More text"}},
			truncated: true,
			check: func(t *testing.T, fields map[string]*structpb.Value) {
				require.Len(t, fields["messages"].GetListValue().Values, 1)
				assert.Equal(t, full, fields["messages"].GetListValue().Values[0].GetStringValue())
			},
		},
		{
			name:      "exact fit omits a later field",
			values:    map[string]any{SEARCH_FIELD_TITLE: "Overview", "messages": full, "zzz": "More text"},
			truncated: true,
			check: func(t *testing.T, fields map[string]*structpb.Value) {
				assert.Equal(t, full, fields["messages"].GetStringValue())
				assert.NotContains(t, fields, "zzz")
			},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			before, err := json.Marshal(tt.values)
			require.NoError(t, err)
			fields, truncated := boundedLexicalFields(tt.values)
			assert.Equal(t, tt.truncated, truncated)
			bytes := 0
			for name, value := range fields {
				bytes += len(name) + len(value.GetStringValue())
				for _, item := range value.GetListValue().GetValues() {
					bytes += len(item.GetStringValue())
				}
			}
			assert.LessOrEqual(t, bytes, maxHybridLexicalBytes)
			assert.Equal(t, "Overview", fields[SEARCH_FIELD_TITLE].GetStringValue())
			tt.check(t, fields)
			for range 3 {
				repeated, repeatedTruncated := boundedLexicalFields(tt.values)
				assert.True(t, proto.Equal(&structpb.Struct{Fields: fields}, &structpb.Struct{Fields: repeated}), "map iteration must not change retained values")
				assert.Equal(t, truncated, repeatedTruncated)
			}
			after, err := json.Marshal(tt.values)
			require.NoError(t, err)
			assert.Equal(t, before, after, "truncation must not mutate the search response values")
		})
	}
}

func TestHybridSearch_LargeLexicalResponseFitsGRPCLimit(t *testing.T) {
	rows := make([][3]string, 200)
	for i := range rows {
		rows[i] = [3]string{fmt.Sprintf("resource-%03d", i), "Overview", ""}
	}
	lexical := lexFieldValueResponse(rows...)
	lexical.Fields = append(lexical.Fields, &resourcepb.ResourceSearchField{Name: SEARCH_FIELD_DESCRIPTION, Type: resourcepb.ResourceSearchField_STRING})
	for _, row := range lexical.Rows {
		row.Values = append(row.Values, &resourcepb.ResourceSearchValue{FieldIndex: 2, StringValues: []string{strings.Repeat("database ", 4096)}})
	}
	s, _, _ := newHybridTestServer(lexical, &fakeVectorBackend{})
	s.reranker = rerankTestReranker(&fakeRerankScorer{}, rerank.RelevanceThresholds{})
	resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "database", Limit: 200})
	require.NoError(t, err)
	require.Len(t, resp.Results, len(rows))
	for _, result := range resp.Results {
		assert.NotEmpty(t, result.Lexical[SEARCH_FIELD_DESCRIPTION].GetStringValue())
	}
	assert.Less(t, proto.Size(resp), 4*1024*1024, "the complete response must fit the default gRPC receive limit")
}
