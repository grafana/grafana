package elasticsearch

import (
	"strings"

	"github.com/blevesearch/bleve/v2/analysis/lang/en"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

const standardAnalyzer = "grafana_standard"

func indexMapping(provider resource.SearchFieldsProvider, key resource.NamespacedResource) elasticsearchObject {
	properties := elasticsearchObject{}
	put := func(name string, field elasticsearchObject) {
		object := properties
		parts := strings.Split(name, ".")
		for _, part := range parts[:len(parts)-1] {
			if object[part] == nil {
				object[part] = elasticsearchObject{"properties": elasticsearchObject{}}
			}
			object = object[part].(elasticsearchObject)["properties"].(elasticsearchObject)
		}
		object[parts[len(parts)-1]] = field
	}
	for _, field := range search.AdapterFields(provider, key) {
		def := field.Definition
		typeName := map[resource.SearchFieldType]string{resource.SearchFieldTypeString: "keyword", resource.SearchFieldTypeInt64: "long", resource.SearchFieldTypeDouble: "double", resource.SearchFieldTypeBoolean: "boolean", resource.SearchFieldTypeDate: "long"}[def.Type]
		options := elasticsearchObject{"type": typeName}
		if def.HasCapability(resource.SearchCapabilityText) {
			options = elasticsearchObject{"type": "text", "analyzer": standardAnalyzer}
		}
		put(field.Prefix+def.Name, options)
		if def.Array && def.HasCapability(resource.SearchCapabilitySort) {
			name := field.Prefix + def.Name
			if keyword, ok := search.KeywordVariant(def); ok {
				name, options = field.Prefix+keyword, elasticsearchObject{"type": "keyword"}
			}
			put(elasticsearchArraySortPrefix+name, options)
		}
		if name, ok := search.KeywordVariant(def); ok && name != def.Name {
			put(field.Prefix+name, elasticsearchObject{"type": "keyword"})
		}
		if name, ok := search.NgramVariant(def); ok {
			put(field.Prefix+name, elasticsearchObject{"type": "text", "analyzer": "grafana_ngram"})
		}
	}
	for _, field := range []string{elasticsearchDocumentIDField, resource.SEARCH_FIELD_RV_STRING, resource.SEARCH_FIELD_DELETED_RV_SORT} {
		put(field, elasticsearchObject{"type": "keyword"})
	}
	for _, field := range []string{resource.SEARCH_FIELD_IS_DELETED, resource.SEARCH_FIELD_IS_PROVISIONED} {
		put(field, elasticsearchObject{"type": "boolean"})
	}
	for _, field := range []string{"labels", "reference", "selectableFields"} {
		properties[field] = elasticsearchObject{"type": "object", "dynamic": true}
	}
	var stopwords []string
	for line := range strings.SplitSeq(string(en.EnglishStopWords), "\n") {
		word, _, _ := strings.Cut(line, "|")
		if word = strings.TrimSpace(word); word != "" {
			stopwords = append(stopwords, word)
		}
	}
	return elasticsearchObject{
		// Leave shard and replica counts to Elasticsearch defaults or index templates.
		"settings": elasticsearchObject{"index.max_ngram_diff": 7,
			"analysis": elasticsearchObject{
				"filter": elasticsearchObject{"grafana_ngrams": elasticsearchObject{"type": "ngram", "min_gram": 3, "max_gram": 10}, "grafana_stop": elasticsearchObject{"type": "stop", "stopwords": stopwords}},
				"analyzer": elasticsearchObject{
					// Use the Bleve stop-word list to keep text matching consistent across backends.
					standardAnalyzer: elasticsearchObject{"type": "custom", "tokenizer": "standard", "filter": []string{"lowercase", "grafana_stop"}},
					"grafana_ngram":  elasticsearchObject{"type": "custom", "tokenizer": "whitespace", "filter": []string{"grafana_ngrams", "lowercase", "unique"}},
				},
			},
		},
		"mappings": elasticsearchObject{"dynamic": false, "properties": properties, "dynamic_templates": []elasticsearchObject{
			{"keyword_data": elasticsearchObject{"match_mapping_type": "string", "mapping": elasticsearchObject{"type": "keyword"}}},
		}},
	}
}
