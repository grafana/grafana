package search

import (
	"github.com/blevesearch/bleve/v2/analysis/analyzer/custom"
	"github.com/blevesearch/bleve/v2/analysis/token/edgengram"
	"github.com/blevesearch/bleve/v2/analysis/token/lowercase"
	"github.com/blevesearch/bleve/v2/analysis/token/unique"
	"github.com/blevesearch/bleve/v2/analysis/tokenizer/whitespace"
	"github.com/blevesearch/bleve/v2/mapping"
)

const TITLE_ANALYZER = "title_analyzer"

func RegisterCustomAnalyzers(mapper *mapping.IndexMappingImpl) error {
	return registerTitleAnalyzer(mapper)
}

// The registerTitleAnalyzer function defines a custom analyzer for the title field.
// The edgeNgramTokenFilter will create n-grams anchored to the front of each token.
// For example, the token "hello" will be tokenized into "hel", "hell", "hello".
func registerTitleAnalyzer(mapper *mapping.IndexMappingImpl) error {
	// Define an N-Gram tokenizer (for substring search)
	edgeNgramTokenFilter := map[string]interface{}{
		"type": edgengram.Name,
		"min":  3.0,
		"max":  10.0,
		"back": edgengram.FRONT,
	}
	err := mapper.AddCustomTokenFilter("edge_ngram_filter", edgeNgramTokenFilter)
	if err != nil {
		return err
	}

	//Create a custom analyzer using the N-Gram tokenizer
	ngramAnalyzer := map[string]interface{}{
		"type":          custom.Name,
		"tokenizer":     whitespace.Name,
		"token_filters": []string{"edge_ngram_filter", lowercase.Name, unique.Name},
		//"char_filters":  //TODO IF NEEDED
	}

	err = mapper.AddCustomAnalyzer(TITLE_ANALYZER, ngramAnalyzer)
	if err != nil {
		return err
	}

	return nil
}
