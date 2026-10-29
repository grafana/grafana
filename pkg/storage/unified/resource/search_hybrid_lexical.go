package resource

import (
	"slices"
	"strings"

	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util"
)

// Bound the extra reranking context across all fields and array elements.
const maxLexicalRerankTextBytes = 4096

// Bound the returned fields separately from the text sent to the reranker.
const maxHybridLexicalBytes = 4096

// hybridLexicalFields selects text fields from the serving index's definitions.
// queryFields controls matching; rerankFields selects retrievable values returned
// by that same search for reranking, and is empty when reranking is disabled.
func hybridLexicalFields(definitions []SearchFieldDefinition, rerank bool) (queryFields []*resourcepb.ResourceSearchRequest_QueryField, rerankFields []string) {
	for _, field := range definitions {
		if field.Type != SearchFieldTypeString || !field.HasCapability(SearchCapabilityText) {
			continue
		}
		// Bleve expands title into its boosted variants; other text fields need
		// an explicit boost because the protobuf default is zero.
		queryFields = append(queryFields, &resourcepb.ResourceSearchRequest_QueryField{Name: field.Name, Boost: 1})
		if rerank && field.HasCapability(SearchCapabilityRetrieve) {
			rerankFields = append(rerankFields, field.Name)
		}
	}
	return queryFields, rerankFields
}

// boundedLexicalFields converts strings and string arrays into result fields,
// sharing a 4 KiB budget across field names and values. Title takes priority,
// then fields are sorted by name so truncation is deterministic. Empty values
// are omitted, and truncation preserves UTF-8. The boolean reports whether the
// byte limit dropped nonempty text.
func boundedLexicalFields(values map[string]any) (map[string]*structpb.Value, bool) {
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
	truncated := false
	for _, name := range names {
		if remaining == 0 && truncated {
			break
		}
		budget := max(remaining-len(name), 0)
		switch value := values[name].(type) {
		case string:
			text := util.TruncateUTF8(value, budget)
			truncated = truncated || len(text) < len(value)
			if text != "" {
				fields[name] = structpb.NewStringValue(text)
				remaining = budget - len(text)
			}
		case []string:
			list := &structpb.ListValue{}
			for _, text := range value {
				retained := util.TruncateUTF8(text, budget)
				if retained != "" {
					list.Values = append(list.Values, structpb.NewStringValue(retained))
					budget -= len(retained)
				}
				if len(retained) < len(text) {
					truncated = true
					break
				}
			}
			if len(list.Values) > 0 {
				fields[name] = structpb.NewListValue(list)
				remaining = budget
			}
		}
	}
	return fields, truncated
}

// lexicalRerankText builds reranker context from returned lexical fields, excluding
// folder/manager metadata and duplicate or empty text. Title comes first, then
// fields in name order; the combined text is capped at 4 KiB. The boolean reports
// whether the byte limit dropped nonempty text.
func lexicalRerankText(fields map[string]*structpb.Value) (string, bool) {
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
			if text.Len() == maxLexicalRerankTextBytes {
				return text.String(), true
			}
			seen[value] = struct{}{}
			if text.Len() > 0 {
				text.WriteByte('\n')
			}
			remaining := maxLexicalRerankTextBytes - text.Len()
			retained := util.TruncateUTF8(value, remaining)
			text.WriteString(retained)
			if len(retained) < len(value) {
				return text.String(), true
			}
		}
	}
	return text.String(), false
}
