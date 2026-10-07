package resource

import (
	"slices"
	"strings"
	"unicode"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util"
)

// Bound the extra reranking context across all fields and array elements.
const maxLexicalRerankTextBytes = 4096

func (s *searchServer) hybridLexicalFields(req *resourcepb.HybridSearchRequest) (queryFields []*resourcepb.ResourceSearchRequest_QueryField, rerankFields []string) {
	definitions := StandardSearchFieldDefinitions()
	if s.searchFields != nil {
		_, _, provider := s.searchFields.For(NewLowerGroupResource(req.Key.Group, req.Key.Resource))
		if provider != nil {
			definitions = append(definitions, provider.Fields(schema.GroupVersionResource{Group: req.Key.Group, Resource: req.Key.Resource})...)
		}
	}
	for _, field := range definitions {
		if field.Type != SearchFieldTypeString || !field.HasCapability(SearchCapabilityText) {
			continue
		}
		// Bleve expands title into its boosted variants; other text fields need
		// an explicit boost because the protobuf default is zero.
		queryFields = append(queryFields, &resourcepb.ResourceSearchRequest_QueryField{Name: field.Name, Boost: 1})
		if s.reranker != nil && !req.SkipRerank && field.HasCapability(SearchCapabilityRetrieve) {
			rerankFields = append(rerankFields, field.Name)
		}
	}
	return queryFields, rerankFields
}

func lexicalRerankTerms(query string) []string {
	return strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
}

// This is a text-selection heuristic, not a reconstruction of Bleve's matches.
func matchingLexicalText(values map[string]any, fields, terms []string) string {
	if len(fields) == 0 || len(terms) == 0 {
		return ""
	}
	var text strings.Builder
	seen := make(map[string]struct{})
	for _, field := range fields {
		var candidates []string
		switch value := values[field].(type) {
		case string:
			candidates = []string{value}
		case []string:
			candidates = value
		}
		for _, value := range candidates {
			value = strings.TrimSpace(value)
			if _, ok := seen[value]; ok {
				continue
			}
			lower := strings.ToLower(value)
			if !slices.ContainsFunc(terms, func(term string) bool { return strings.Contains(lower, term) }) {
				continue
			}
			seen[value] = struct{}{}
			if text.Len() > 0 {
				text.WriteByte('\n')
			}
			remaining := maxLexicalRerankTextBytes - text.Len()
			text.WriteString(util.TruncateUTF8(value, remaining))
			if len(value) >= remaining {
				return text.String()
			}
		}
	}
	return text.String()
}
