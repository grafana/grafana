package search

import (
	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/mapping"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func GetBleveMappings(fields resource.SearchableDocumentFields, selectableFields []string) (mapping.IndexMapping, error) {
	mapper := bleve.NewIndexMapping()

	err := RegisterCustomAnalyzers(mapper)
	if err != nil {
		return nil, err
	}
	mapper.DefaultMapping = getBleveDocMappings(fields, selectableFields)

	return mapper, nil
}

func getBleveDocMappings(fields resource.SearchableDocumentFields, selectableFields []string) *mapping.DocumentMapping {
	mapper := bleve.NewDocumentStaticMapping()

	nameMapping := &mapping.FieldMapping{
		Analyzer: keyword.Name,
		Type:     "text",
		Index:    true,
	}
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_NAME, nameMapping)

	// for sorting by title full phrase
	titlePhraseMapping := bleve.NewKeywordFieldMapping()
	titlePhraseMapping.Store = false // already stored in title
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE_PHRASE, titlePhraseMapping)

	// for searching by title - uses an edge ngram token filter
	titleSearchMapping := bleve.NewTextFieldMapping()
	titleSearchMapping.Analyzer = TITLE_ANALYZER
	titleSearchMapping.Store = false // already stored in title

	// mapping for title to search on words/tokens larger than the ngram size
	titleWordMapping := bleve.NewTextFieldMapping()
	titleWordMapping.Analyzer = standard.Name
	titleWordMapping.Store = true
	// NOTE: this causes 3 title fields in the response
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE, titleWordMapping, titleSearchMapping, titlePhraseMapping)

	descriptionMapping := &mapping.FieldMapping{
		Name:               resource.SEARCH_FIELD_DESCRIPTION,
		Type:               "text",
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          false,
	}
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_DESCRIPTION, descriptionMapping)

	tagsMapping := &mapping.FieldMapping{
		Name:               resource.SEARCH_FIELD_TAGS,
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
		DocValues:          false,
	}
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TAGS, tagsMapping)

	folderMapping := &mapping.FieldMapping{
		Name:               resource.SEARCH_FIELD_FOLDER,
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
		DocValues:          true, // will be needed for authz client
	}
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_FOLDER, folderMapping)

	// Repositories
	manager := bleve.NewDocumentStaticMapping()
	manager.AddFieldMappingsAt("kind", &mapping.FieldMapping{
		Name:               "kind",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
	})
	manager.AddFieldMappingsAt("id", &mapping.FieldMapping{
		Name:               "id",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
	})

	source := bleve.NewDocumentStaticMapping()
	source.AddFieldMappingsAt("path", &mapping.FieldMapping{
		Name:               "path",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
	})
	source.AddFieldMappingsAt("checksum", &mapping.FieldMapping{
		Name:               "checksum",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
	})
	source.AddFieldMappingsAt("timestampMillis", mapping.NewNumericFieldMapping())

	mapper.AddSubDocumentMapping("source", source)
	mapper.AddSubDocumentMapping("manager", manager)
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_MANAGED_BY, &mapping.FieldMapping{
		Name:               "managedBy",
		Type:               "text",
		Analyzer:           keyword.Name,
		Index:              true, // only used for faceting
		Store:              false,
		IncludeTermVectors: false,
		IncludeInAll:       false,
	})

	referenceMapper := bleve.NewDocumentMapping()
	referenceMapper.DefaultAnalyzer = keyword.Name
	mapper.AddSubDocumentMapping("reference", referenceMapper)

	labelMapper := bleve.NewDocumentMapping()
	mapper.AddSubDocumentMapping(resource.SEARCH_FIELD_LABELS, labelMapper)

	fieldMapper := bleve.NewDocumentMapping()
	if fields != nil {
		for _, field := range fields.Fields() {
			def := fields.Field(field)

			// Filterable should use keyword analyzer for exact matches
			if def.Properties != nil && def.Properties.Filterable && def.Type == resourcepb.ResourceTableColumnDefinition_STRING {
				keywordMapping := bleve.NewKeywordFieldMapping()
				keywordMapping.Store = true

				fieldMapper.AddFieldMappingsAt(def.Name, keywordMapping)
			}
			// For all other fields, we do nothing.
			// Bleve will see them at index time and dynamically map them as
			// numeric, datetime, boolean, or standard text based on their content.
		}
	}

	mapper.AddSubDocumentMapping("fields", fieldMapper)

	selectableFieldsMapper := bleve.NewDocumentStaticMapping()
	for _, field := range selectableFields {
		selectableFieldsMapper.AddFieldMappingsAt(field, &mapping.FieldMapping{
			Name:     field,
			Type:     "text",
			Analyzer: keyword.Name,
			Store:    false,
			Index:    true,
		})
	}
	mapper.AddSubDocumentMapping("selectable_fields", selectableFieldsMapper)

	return mapper
}

/*
Here's a tree representation of the field mappings in pkg/storage/unified/search/bleve_mappings.go:

  Document Root (DefaultMapping)
  │
  ├── name [text, keyword analyzer]
  │
  ├── title_phrase [keyword, not stored]
  │
  ├── title [3 mappings]
  │   ├── [1] standard analyzer, stored
  │   ├── [2] TITLE_ANALYZER (edge ngram), not stored
  │   └── [3] keyword, not stored
  │
  ├── description [text, stored]
  │
  ├── tags [text, keyword analyzer, stored, includeInAll]
  │
  ├── folder [text, keyword analyzer, stored, includeInAll, docValues]
  │
  ├── managedBy [text, keyword analyzer, not stored]
  │
  ├── source/ [sub-document]
  │   ├── path [text, keyword analyzer, stored]
  │   ├── checksum [text, keyword analyzer, stored]
  │   └── timestampMillis [numeric]
  │
  ├── manager/ [sub-document]
  │   ├── kind [text, keyword analyzer, stored, includeInAll]
  │   └── id [text, keyword analyzer, stored, includeInAll]
  │
  ├── reference/ [sub-document, default analyzer: keyword]
  │   └── (dynamic fields inherit keyword analyzer)
  │
  ├── labels/ [sub-document]
  │   └── (dynamic fields)
  │
  └── fields/ [sub-document]
      └── (conditional mappings)
          ├── {filterable string fields} [keyword, stored]
          └── {other fields} [dynamically mapped by Bleve]

  Key observations:

  - Root level has standard searchable fields (name, title, description, tags, folder)
  - title has 3 analyzers applied: standard (for word search), edge ngram (for prefix search), and keyword (for phrase sorting)
  - source/, manager/: Static sub-documents with explicitly mapped fields
  - reference/: Dynamic sub-document with keyword default analyzer (line 142)
  - labels/, fields/: Dynamic sub-documents where Bleve auto-detects field types at index time

  References:
  - Main mapping function: pkg/storage/unified/search/bleve_mappings.go:25-169
  - Sub-document mappings: lines 88-143
  - Dynamic fields handling: lines 148-166
*/
