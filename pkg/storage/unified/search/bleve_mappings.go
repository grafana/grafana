package search

import (
	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/mapping"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func getBleveMappings(fields resource.SearchableDocumentFields) mapping.IndexMapping {
	mapper := bleve.NewIndexMapping()
	mapper.DefaultMapping = getBleveDocMappings(fields)
	return mapper
}

func getBleveDocMappings(_ resource.SearchableDocumentFields) *mapping.DocumentMapping {
	mapper := bleve.NewDocumentStaticMapping()

	// for sorting by title
	titleSortMapping := bleve.NewKeywordFieldMapping()
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE_SORT, titleSortMapping)

	// for searching by title
	titleSearchMapping := bleve.NewTextFieldMapping()
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE, titleSearchMapping)

	// for filtering by kind/resource ( federated search )
	kindMapping := bleve.NewTextFieldMapping()
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_KIND, kindMapping)

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

	repoMapping := &mapping.FieldMapping{
		Name:               resource.SEARCH_FIELD_REPOSITORY,
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       true,
		DocValues:          true,
	}
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_REPOSITORY, repoMapping)

	// TODO: we use the static mapper. why set dynamic to true?
	mapper.Dynamic = true

	return mapper
}
