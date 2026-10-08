package resource

import (
	"slices"
	"strings"

	"google.golang.org/protobuf/types/known/structpb"
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

func lexicalRerankText(fields map[string]*structpb.Value) string {
	// Keep title first and make truncation deterministic despite map iteration order.
	names := make([]string, 1, len(fields)+1)
	names[0] = SEARCH_FIELD_TITLE
	for name := range fields {
		if name != SEARCH_FIELD_TITLE {
			names = append(names, name)
		}
	}
	slices.Sort(names[1:])
	var text strings.Builder
	seen := make(map[string]struct{})
	for _, name := range names {
		// The lexical request returns searchable text plus these metadata fields.
		switch name {
		case SEARCH_FIELD_FOLDER, SEARCH_FIELD_MANAGER_KIND, SEARCH_FIELD_MANAGER_ID:
			continue
		}
		value := fields[name]
		values := []*structpb.Value{value}
		if list := value.GetListValue(); list != nil {
			values = list.Values
		}
		for _, item := range values {
			value := strings.TrimSpace(item.GetStringValue())
			if _, ok := seen[value]; ok || value == "" {
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
