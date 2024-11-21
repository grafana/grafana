package search

import (
	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/mapping"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type bleveFlatDocument struct {
	// The group/resource (essentially kind)
	gr string

	Title       string `json:"title,omitempty"`
	TitleSort   string `json:"title_sort,omitempty"`
	Description string `json:"description,omitempty"`

	Tags []string `json:"tags,omitempty"`

	Labels map[string]string `json:"labels,omitempty"`
	Folder string            `json:"folder,omitempty"`

	// Custom fields
	Fields map[string]any `json:"fields,omitempty"`
}

func (d bleveFlatDocument) Type() string {
	return d.gr
}

func getBleveMappings(gr string, fields resource.SearchableDocumentFields) mapping.IndexMapping {
	mapper := bleve.NewIndexMapping()
	// mapper.TypeField = "gr"
	mapper.AddDocumentMapping(gr, getBleveDocMappings(fields))
	return mapper
}

func getBleveDocMappings(_ resource.SearchableDocumentFields) *mapping.DocumentMapping {
	mapper := bleve.NewDocumentStaticMapping()
	// mapper.AddFieldMapping(&mapping.FieldMapping{
	// 	Name:               "gr", // will be the same in the entire index???
	// 	Type:               "text",
	// 	Analyzer:           keyword.Name,
	// 	Store:              true,
	// 	Index:              true,
	// 	IncludeTermVectors: false,
	// 	IncludeInAll:       false,
	// 	DocValues:          false,
	// })
	mapper.AddFieldMapping(&mapping.FieldMapping{
		Name:               "title",
		Type:               "text",
		Store:              true,
		Index:              true,
		IncludeTermVectors: true,
		IncludeInAll:       true,
		DocValues:          false,
	})

	// set the title field to use keyword analyzer so it sorts by the whole phrase
	// https://github.com/blevesearch/bleve/issues/417#issuecomment-245273022
	mapper.AddFieldMapping(&mapping.FieldMapping{
		Name:               "title_sort",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              false, // not stored!
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          false,
	})

	mapper.AddFieldMapping(&mapping.FieldMapping{
		Name:               "description",
		Type:               "text",
		Store:              true, // not but searchable?
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          false,
	})

	mapper.AddFieldMapping(&mapping.FieldMapping{
		Name:               "Tags",
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true, // not stored!
		Index:              true,
		IncludeTermVectors: false,
		IncludeInAll:       false,
		DocValues:          false,
	})

	mapper.Dynamic = true

	return mapper
}
