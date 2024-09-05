package main

import (
	"fmt"
	"unicode"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/mapping"
)

type input struct {
	Name string
}

type CapitalizedTokenFilter map[string]interface{}

func main() {
	if err := index(); err != nil {
		fmt.Println(err)
	}
}

func createIndexingMapping(indexName string, mapping *mapping.IndexMappingImpl) (bleve.Index, error) {
	index, err := bleve.New(indexName, mapping)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}
	return index, nil
}

func index() error {
	mapping := bleve.NewIndexMapping()
	index, err := createIndexingMapping("example.bleve", mapping)
	if err != nil {
		return err
	}
	data := []input{{Name: "text"}, {Name: "Text"}}

	// index some data
	index.Index("id", data)

	// search for some text
	query := bleve.NewMatchQuery("text")
	search := bleve.NewSearchRequest(query)
	searchResults, err := index.Search(search)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	fmt.Println(searchResults)

	customIndex, err := createIndexingMapping("custom.bleve", mapping)
	if err != nil {
		return err
	}
	if err := withTokenFilter(mapping); err != nil {
		fmt.Println(err)
	}

	customIndex.Index("id", data)
	return nil
}

func withTokenFilter(m *mapping.IndexMappingImpl) error {
	err := m.AddCustomTokenFilter("capitalized_filter", NewCapitalizedTokenFilter())
	return err

}

func NewCapitalizedTokenFilter() map[string]interface{} {
	ctf := &CapitalizedTokenFilter{
		"type": "capitalized_filter",
	}
	return map[string]interface{}{"capitalized_filter": ctf}
}

// Implementation of filtering only capitalized tokens
func (ctf *CapitalizedTokenFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	var output analysis.TokenStream
	for _, token := range input {
		if len(token.Term) > 0 && unicode.IsUpper(rune(token.Term[0])) {
			output = append(output, token)
		}
	}
	return output
}
