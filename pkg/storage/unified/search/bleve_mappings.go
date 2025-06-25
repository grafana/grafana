package search

import (
	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/mapping"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func GetBleveMappings(fields resource.SearchableDocumentFields) (mapping.IndexMapping, error) {
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
	mapper.AddSubDocumentMapping("fields", fieldMapper)

	return mapper
}
