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
	mapper.AddFieldMapping(&mapping.FieldMapping{
		Name: "title",
		Type: "text",
		// TODO - if we don't want title to be a keyword, we can use this
		// set the title field to use keyword analyzer so it sorts by the whole phrase
		// https://github.com/blevesearch/bleve/issues/417#issuecomment-245273022
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: true,
		IncludeInAll:       true,
		DocValues:          false,
	})

	mapper.AddFieldMapping(&mapping.FieldMapping{
		Name:               "description",
		Type:               "text",
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          false,
	})

	mapper.AddFieldMapping(&mapping.FieldMapping{
		Name:               "tags",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          false,
	})

	mapper.AddFieldMapping(&mapping.FieldMapping{
		Name:               "folder",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          true, // will be needed for authz client
	})

	mapper.Dynamic = true

	return mapper
}
