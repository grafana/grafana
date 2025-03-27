package search

import (
	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/mapping"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func getBleveMappings(fields resource.SearchableDocumentFields) (mapping.IndexMapping, error) {
	mapper := bleve.NewIndexMapping()

	err := RegisterCustomAnalyzers(mapper)
	if err != nil {
		return nil, err
	}
	mapper.DefaultMapping = getBleveDocMappings(fields)

	return mapper, nil
}

func getBleveDocMappings(_ resource.SearchableDocumentFields) *mapping.DocumentMapping {
	mapper := bleve.NewDocumentStaticMapping()

	nameMapping := &mapping.FieldMapping{
		Analyzer: keyword.Name,
		Type:     "text",
		Index:    true,
	}
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_NAME, nameMapping)

	// for searching by title - uses an edge ngram token filter
	titleSearchMapping := bleve.NewTextFieldMapping()
	titleSearchMapping.Analyzer = TITLE_ANALYZER
	titleSearchMapping.Store = true
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE_NGRAM, titleSearchMapping)

	// mapping for title to search on words/tokens larger than the ngram size
	titleWordMapping := bleve.NewTextFieldMapping()
	titleWordMapping.Analyzer = standard.Name
	titleWordMapping.Store = true
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE, titleWordMapping)

	// for filtering/sorting by title full phrase
	titlePhraseMapping := bleve.NewKeywordFieldMapping()
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE_PHRASE, titlePhraseMapping)

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

	mapper.AddSubDocumentMapping("manager", manager)
	mapper.AddSubDocumentMapping("source", source)

	labelMapper := bleve.NewDocumentMapping()
	mapper.AddSubDocumentMapping(resource.SEARCH_FIELD_LABELS, labelMapper)

	fieldMapper := bleve.NewDocumentMapping()
	mapper.AddSubDocumentMapping("fields", fieldMapper)

	return mapper
}
