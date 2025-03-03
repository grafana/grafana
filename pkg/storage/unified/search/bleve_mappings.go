package search

import (
	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/simple"
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
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE, titleSearchMapping)

	// secondary mapping for title to search on words/tokens larger than the ngram size
	titleWordMapping := bleve.NewTextFieldMapping()
	titleWordMapping.Analyzer = simple.Name
	titleWordMapping.Store = true
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE, titleWordMapping)

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
	repo := bleve.NewDocumentStaticMapping()
	repo.AddFieldMappingsAt("name", &mapping.FieldMapping{
		Name:               "name",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
	})
	repo.AddFieldMappingsAt("path", &mapping.FieldMapping{
		Name:               "path",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
	})
	repo.AddFieldMappingsAt("hash", &mapping.FieldMapping{
		Name:               "hash",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
	})
	repo.AddFieldMappingsAt("time", mapping.NewDateTimeFieldMapping())

	mapper.AddSubDocumentMapping("repo", repo)

	labelMapper := bleve.NewDocumentMapping()
	mapper.AddSubDocumentMapping(resource.SEARCH_FIELD_LABELS, labelMapper)

	fieldMapper := bleve.NewDocumentMapping()
	mapper.AddSubDocumentMapping("fields", fieldMapper)

	return mapper
}
