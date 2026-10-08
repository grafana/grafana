package resource

import (
	"encoding/json"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/structpb"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

func TestHybridSearch_LexicalHitRerankText(t *testing.T) {
	for _, tt := range []struct {
		name       string
		title      string
		semantic   bool
		legacy     bool
		otherQuery bool
		skipRerank bool
		noReranker bool
		wantText   string
	}{
		{name: "lexical only", wantText: "Overview\nDatabase operations\nUnrelated message\nRequests timeout during peak traffic\nInvestigating DATABASE connection failures"},
		{name: "title is not repeated", title: "Database overview", wantText: "Database overview\nDatabase operations\nUnrelated message\nRequests timeout during peak traffic\nInvestigating DATABASE connection failures"},
		{name: "both legs", semantic: true, wantText: "Semantic context\nOverview\nDatabase operations\nUnrelated message\nRequests timeout during peak traffic\nInvestigating DATABASE connection failures"},
		{name: "legacy response falls back to title", legacy: true, wantText: "Overview"},
		{name: "text does not depend on query words", otherQuery: true, wantText: "Overview\nDatabase operations\nUnrelated message\nRequests timeout during peak traffic\nInvestigating DATABASE connection failures"},
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
			if tt.otherQuery {
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
			if tt.legacy {
				assert.Nil(t, resp.Results[0].Lexical)
			} else {
				wantValues := map[string]any{
					SEARCH_FIELD_TITLE:        title,
					SEARCH_FIELD_FOLDER:       "",
					SEARCH_FIELD_DESCRIPTION:  "Database operations",
					SEARCH_FIELD_MANAGER_KIND: "provisioning",
					SEARCH_FIELD_MANAGER_ID:   "repository-1",
					"summary":                 "Investigating DATABASE connection failures",
					"messages":                []any{"Unrelated message", "Requests timeout during peak traffic", "Requests timeout during peak traffic"},
				}
				wantLexical, err := structpb.NewStruct(wantValues)
				require.NoError(t, err)
				assert.Equal(t, wantLexical.Fields, resp.Results[0].Lexical)
				if tt.name == "lexical only" {
					encoded, err := protojson.Marshal(resp.Results[0])
					require.NoError(t, err)
					var result map[string]any
					require.NoError(t, json.Unmarshal(encoded, &result))
					assert.Equal(t, wantValues, result["lexical"])
				}
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
		assert.Equal(t, "Overview\nService status\nLe délai est élevé\nUnrelated message\nSummary", lexicalRerankText(hit.Fields))
	})

	t.Run("bounds all values without splitting UTF-8", func(t *testing.T) {
		values := []any{"Details", strings.Repeat("界", maxLexicalRerankTextBytes)}
		hit, err := structpb.NewStruct(map[string]any{"messages": values})
		require.NoError(t, err)
		text := lexicalRerankText(hit.Fields)
		assert.LessOrEqual(t, len(text), maxLexicalRerankTextBytes)
		assert.Greater(t, len(text), maxLexicalRerankTextBytes-utf8.UTFMax)
		assert.True(t, utf8.ValidString(text))
		assert.True(t, strings.HasPrefix(text, "Details\n界"))
		assert.Equal(t, values[1], hit.Fields["messages"].GetListValue().Values[1].GetStringValue())
	})
}
