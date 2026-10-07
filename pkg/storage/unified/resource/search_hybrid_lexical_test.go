package resource

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

func TestHybridSearch_MatchingLexicalRerankText(t *testing.T) {
	for _, tt := range []struct {
		name       string
		title      string
		semantic   bool
		legacy     bool
		noMatch    bool
		skipRerank bool
		noReranker bool
		wantText   string
	}{
		{name: "lexical only", wantText: "Overview\nDatabase operations\nInvestigating DATABASE connection failures\nRequests timeout during peak traffic"},
		{name: "matching title is not repeated", title: "Database overview", wantText: "Database overview\nDatabase operations\nInvestigating DATABASE connection failures\nRequests timeout during peak traffic"},
		{name: "both legs", semantic: true, wantText: "Semantic context\nDatabase operations\nInvestigating DATABASE connection failures\nRequests timeout during peak traffic"},
		{name: "legacy response falls back to title", legacy: true, wantText: "Overview"},
		{name: "no matching values falls back to title", noMatch: true, wantText: "Overview"},
		{name: "skip rerank", skipRerank: true},
		{name: "no reranker", noReranker: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			title := tt.title
			if title == "" {
				title = "Overview"
			}
			lexResp := lexFieldValueResponse([3]string{"a", title, ""})
			lexResp.Fields = append(lexResp.Fields,
				&resourcepb.ResourceSearchField{Name: "summary", Type: resourcepb.ResourceSearchField_STRING},
				&resourcepb.ResourceSearchField{Name: "messages", Type: resourcepb.ResourceSearchField_STRING, IsArray: true},
				&resourcepb.ResourceSearchField{Name: "category", Type: resourcepb.ResourceSearchField_STRING},
				&resourcepb.ResourceSearchField{Name: SEARCH_FIELD_DESCRIPTION, Type: resourcepb.ResourceSearchField_STRING},
			)
			lexResp.Rows[0].Values = append(lexResp.Rows[0].Values,
				&resourcepb.ResourceSearchValue{FieldIndex: 2, StringValues: []string{"Investigating DATABASE connection failures"}},
				&resourcepb.ResourceSearchValue{FieldIndex: 3, StringValues: []string{"Unrelated message", "Requests timeout during peak traffic", "Requests timeout during peak traffic"}},
				&resourcepb.ResourceSearchValue{FieldIndex: 4, StringValues: []string{"database label without text capability"}},
				&resourcepb.ResourceSearchValue{FieldIndex: 5, StringValues: []string{"Database operations"}},
			)
			if tt.legacy {
				lexResp = lexTableResponse([3]string{"a", "Overview", ""})
			}
			backend := &fakeVectorBackend{}
			if tt.semantic {
				backend.results = []vector.VectorSearchResult{{UID: "a", Content: "Semantic context"}}
			}
			s, idx, _ := newHybridTestServer(lexResp, backend)
			provider := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
				{Group: "g", Resource: "r", Version: "v1"}: {
					{Name: "summary", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityText, SearchCapabilityRetrieve}},
					{Name: "category", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityRetrieve}},
					{Name: "unstored", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityText}},
				},
				{Group: "g", Resource: "r", Version: "v2"}: {
					{Name: "messages", Type: SearchFieldTypeString, Array: true, Capabilities: []SearchCapability{SearchCapabilityText, SearchCapabilityRetrieve}},
				},
			}, nil)
			s.searchFields = NewSearchFieldsRegistry(nil, nil, map[LowerGroupResource]SearchFieldsProvider{
				NewLowerGroupResource("g", "r"): provider,
			})
			scorer := &fakeRerankScorer{}
			if !tt.noReranker {
				s.reranker = rerankTestReranker(scorer, rerank.RelevanceThresholds{})
			}
			query := "Database, TIMEOUT!"
			if tt.noMatch {
				query = "unmatched"
			}
			resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
				Key: validKey(), Query: query, SemanticQuery: "Different semantic wording", SkipRerank: tt.skipRerank,
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
				assert.ElementsMatch(t, []string{SEARCH_FIELD_TITLE, SEARCH_FIELD_FOLDER, SEARCH_FIELD_MANAGER_KIND, SEARCH_FIELD_MANAGER_ID, SEARCH_FIELD_DESCRIPTION, "summary", "messages"}, idx.gotReq.Fields)
			}
			require.Len(t, resp.Results[0].Chunks, 1)
			if tt.semantic {
				assert.Equal(t, "Semantic context", resp.Results[0].Chunks[0].Content)
			} else {
				assert.Equal(t, title, resp.Results[0].Chunks[0].Content)
			}
		})
	}
}

func TestMatchingLexicalText(t *testing.T) {
	for _, tt := range []struct {
		name  string
		query string
		value any
		want  string
	}{
		{name: "unicode case folding", query: "DÉLAI", value: "Le délai est élevé", want: "Le délai est élevé"},
		{name: "substring", query: "time", value: "Requests timeout", want: "Requests timeout"},
		{name: "no words", query: "*?!", value: "All text"},
		{name: "missing field", query: "timeout"},
		{name: "non-text value", query: "123", value: 123},
	} {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, matchingLexicalText(map[string]any{"description": tt.value}, []string{"description"}, lexicalRerankTerms(tt.query)))
		})
	}

	t.Run("bounds all values without splitting UTF-8", func(t *testing.T) {
		text := matchingLexicalText(map[string]any{
			"description": []string{"timeout details", "timeout " + strings.Repeat("界", maxLexicalRerankTextBytes)},
		}, []string{"description"}, []string{"timeout"})
		assert.LessOrEqual(t, len(text), maxLexicalRerankTextBytes)
		assert.Greater(t, len(text), maxLexicalRerankTextBytes-utf8.UTFMax)
		assert.True(t, utf8.ValidString(text))
		assert.True(t, strings.HasPrefix(text, "timeout details\ntimeout "))
	})
}
