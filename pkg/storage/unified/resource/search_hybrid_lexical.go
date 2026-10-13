package resource

import (
	"slices"
	"strings"

	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/types/known/structpb"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util"
)

// Bound the extra reranking context across all fields and array elements.
const maxLexicalRerankTextBytes = 4096

// Bound the returned fields separately from the text sent to the reranker.
const maxHybridLexicalBytes = 4096

func (s *searchServer) hybridLexicalFields(key *resourcepb.ResourceKey, skipRerank bool) (queryFields []*resourcepb.ResourceSearchRequest_QueryField, rerankFields []string) {
	definitions := StandardSearchFieldDefinitions()
	if s.searchFields != nil {
		_, _, provider := s.searchFields.For(NewLowerGroupResource(key.Group, key.Resource))
		if provider != nil {
			definitions = append(definitions, provider.Fields(schema.GroupVersionResource{Group: key.Group, Resource: key.Resource})...)
		}
	}
	for _, field := range definitions {
		if field.Type != SearchFieldTypeString || !field.HasCapability(SearchCapabilityText) {
			continue
		}
		// Bleve expands title into its boosted variants; other text fields need
		// an explicit boost because the protobuf default is zero.
		queryFields = append(queryFields, &resourcepb.ResourceSearchRequest_QueryField{Name: field.Name, Boost: 1})
		if s.reranker != nil && !skipRerank && field.HasCapability(SearchCapabilityRetrieve) {
			rerankFields = append(rerankFields, field.Name)
		}
	}
	return queryFields, rerankFields
}

// Keep title first and truncate deterministically within the serialized byte budget.
func boundedLexicalFields(values map[string]any) map[string]*structpb.Value {
	names := make([]string, 1, len(values)+1)
	names[0] = SEARCH_FIELD_TITLE
	for name := range values {
		if name != SEARCH_FIELD_TITLE {
			names = append(names, name)
		}
	}
	slices.Sort(names[1:])
	fields := make(map[string]*structpb.Value)
	remaining := maxHybridLexicalBytes
	for _, name := range names {
		var texts []string
		array := false
		switch value := values[name].(type) {
		case string:
			texts = []string{value}
		case []string:
			texts, array = value, true
		default:
			continue
		}
		var value *structpb.Value
		list := &structpb.ListValue{}
		listSize := 0
		size := 0
		if array {
			value = structpb.NewListValue(list)
			size = lexicalFieldSize(name, protowire.SizeTag(6)+protowire.SizeBytes(0))
		}
		fieldSize := func(text string) int {
			size := protowire.SizeTag(3) + protowire.SizeBytes(len(text))
			if array {
				// Track the list size incrementally so large arrays stay linear.
				size = protowire.SizeTag(6) + protowire.SizeBytes(listSize+protowire.SizeTag(1)+protowire.SizeBytes(size))
			}
			return lexicalFieldSize(name, size)
		}
		for _, text := range texts {
			truncated := util.TruncateUTF8(text, remaining)
			if excess := fieldSize(truncated) - remaining; excess > 0 {
				truncated = util.TruncateUTF8(truncated, max(0, len(truncated)-excess))
			}
			if fieldSize(truncated) > remaining {
				break
			}
			size = fieldSize(truncated)
			item := structpb.NewStringValue(truncated)
			if array {
				list.Values = append(list.Values, item)
				listSize += protowire.SizeTag(1) + protowire.SizeBytes(protowire.SizeTag(3)+protowire.SizeBytes(len(truncated)))
			} else {
				value = item
			}
			if len(truncated) < len(text) {
				break
			}
		}
		if value != nil && size <= remaining {
			fields[name] = value
			remaining -= size
		}
	}
	return fields
}

// Include the map entry and HybridSearchResult.lexical wrappers in the budget.
func lexicalFieldSize(name string, valueSize int) int {
	entrySize := protowire.SizeTag(1) + protowire.SizeBytes(len(name)) +
		protowire.SizeTag(2) + protowire.SizeBytes(valueSize)
	return protowire.SizeTag(9) + protowire.SizeBytes(entrySize)
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
