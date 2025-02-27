package search

import (
	"log"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/custom"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/token/ngram"
	"github.com/blevesearch/bleve/v2/analysis/tokenizer/unicode"
	"github.com/blevesearch/bleve/v2/mapping"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func getBleveMappings(fields resource.SearchableDocumentFields) mapping.IndexMapping {
	mapper := bleve.NewIndexMapping()
	// this will tokenize substrings for ngram search
	// Example: "hello" -> "hel", "ell", "llo"
	// this will allow us to search for a substring of a word without using wildcards which are slow and consumer a lot of memory
	addNgramCustomAnalyzer(mapper)
	mapper.DefaultMapping = getBleveDocMappings(fields)

	return mapper
}

func addNgramCustomAnalyzer(mapper *mapping.IndexMappingImpl) {
	// Define an N-Gram tokenizer (for substring search)
	ngramTokenFilter := map[string]interface{}{
		"type": ngram.Name,
		"min":  3, // Minimum n-gram size (adjust as needed)
		"max":  5, // Maximum n-gram size
		"back": false,
	}
	err := mapper.AddCustomTokenFilter("ngram_filter", ngramTokenFilter)
	if err != nil {
		log.Fatal(err)
	}

	//Create a custom analyzer using the N-Gram tokenizer
	ngramAnalyzer := map[string]interface{}{
		"type":          custom.Name,
		"tokenizer":     unicode.Name,
		"token_filters": []string{"ngram_filter"},
	}

	err = mapper.AddCustomAnalyzer("ngram_analyzer", ngramAnalyzer)
	if err != nil {
		log.Fatal(err)
	}
}

func getBleveDocMappings(_ resource.SearchableDocumentFields) *mapping.DocumentMapping {
	mapper := bleve.NewDocumentStaticMapping()

	nameMapping := &mapping.FieldMapping{
		Analyzer: keyword.Name,
		Type:     "text",
		Index:    true,
	}
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_NAME, nameMapping)

	// for filtering/sorting by title full phrase
	titlePhraseMapping := bleve.NewKeywordFieldMapping()
	titlePhraseMapping.Analyzer = "ngram_analyzer"
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE_PHRASE, titlePhraseMapping)

	// for searching by title
	// TODO: do we still need this since we have SEARCH_FIELD_TITLE_PHRASE?
	titleSearchMapping := bleve.NewTextFieldMapping()
	titleSearchMapping.Analyzer = "ngram_analyzer"
	mapper.AddFieldMappingsAt(resource.SEARCH_FIELD_TITLE, titleSearchMapping)

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
