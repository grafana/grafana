package search

import (
	"strings"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/engine"
)

func esMappingFromSchema(schema []*resourcepb.FieldDescriptor) map[string]any {
	props := map[string]any{
		"name":             map[string]any{"type": "keyword", "doc_values": true},
		"title":            map[string]any{"type": "text", "fields": map[string]any{"keyword": map[string]any{"type": "keyword", "doc_values": true}}},
		"title_phrase":     map[string]any{"type": "keyword", "doc_values": true},
		"title_ngram":      map[string]any{"type": "text", "analyzer": "standard"},
		"folder":           map[string]any{"type": "keyword", "doc_values": true},
		"description":      map[string]any{"type": "text"},
		"tags":             map[string]any{"type": "keyword"},
		"labels":           map[string]any{"type": "object", "dynamic": true},
		"created":          map[string]any{"type": "long", "doc_values": true},
		"created_by":       map[string]any{"type": "keyword"},
		"ownerReferences":  map[string]any{"type": "keyword"},
		"is_deleted":       map[string]any{"type": "boolean"},
		"resource_version": map[string]any{"type": "long"},
	}
	fieldProps := map[string]any{}
	for _, def := range schema {
		if def == nil {
			continue
		}
		sf := engine.FieldDescriptorToSearchField(def)
		fieldProps[sf.Name] = esFieldMapping(sf)
	}
	if len(fieldProps) > 0 {
		props["fields"] = map[string]any{
			"type":       "object",
			"properties": fieldProps,
		}
	}
	return map[string]any{
		"properties": props,
	}
}

func esFieldMapping(def resource.SearchFieldDefinition) map[string]any {
	hasFilter := def.HasCapability(resource.SearchCapabilityFilter)
	hasText := def.HasCapability(resource.SearchCapabilityText)
	hasPartial := def.HasCapability(resource.SearchCapabilityPartial)
	hasSort := def.HasCapability(resource.SearchCapabilitySort)
	hasFacet := def.HasCapability(resource.SearchCapabilityFacet)
	hasRetrieve := def.HasCapability(resource.SearchCapabilityRetrieve)

	needKeyword := hasFilter || hasFacet || hasSort
	m := map[string]any{}
	switch def.Type {
	case resource.SearchFieldTypeInt64, resource.SearchFieldTypeDate:
		m["type"] = "long"
	case resource.SearchFieldTypeDouble:
		m["type"] = "double"
	case resource.SearchFieldTypeBoolean:
		m["type"] = "boolean"
	default:
		if hasText {
			text := map[string]any{"type": "text"}
			if hasRetrieve {
				text["store"] = true
			}
			sub := map[string]any{}
			if needKeyword {
				kw := map[string]any{"type": "keyword"}
				if hasSort {
					kw["doc_values"] = true
				}
				if hasRetrieve && !hasText {
					kw["store"] = true
				}
				sub["keyword"] = kw
			}
			if hasPartial {
				sub["ngram"] = map[string]any{"type": "text", "analyzer": "standard"}
			}
			if len(sub) > 0 {
				text["fields"] = sub
			}
			return text
		}
		m["type"] = "keyword"
	}
	if hasSort {
		m["doc_values"] = true
	}
	if hasRetrieve {
		m["store"] = true
	}
	if def.Array {
		// keyword/text arrays are represented as keyword/text with same mapping
	}
	if hasPartial && !hasText {
		return map[string]any{
			"type": "text",
			"fields": map[string]any{
				"ngram": map[string]any{"type": "text", "analyzer": "standard"},
				"keyword": map[string]any{
					"type": "keyword",
				},
			},
		}
	}
	return m
}

func esKeywordField(field string) string {
	field = strings.TrimPrefix(field, resource.SEARCH_FIELD_PREFIX)
	if field == resource.SEARCH_FIELD_TITLE {
		return "title_phrase"
	}
	return field
}

func esTextFields(fields []string) []string {
	if len(fields) == 0 {
		return []string{"title", "title_ngram", "description"}
	}
	out := make([]string, 0, len(fields)*2)
	for _, f := range fields {
		f = strings.TrimPrefix(f, resource.SEARCH_FIELD_PREFIX)
		out = append(out, f)
		if f == resource.SEARCH_FIELD_TITLE {
			out = append(out, "title_ngram", "title_phrase")
		}
	}
	return out
}
