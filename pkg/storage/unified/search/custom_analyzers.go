package search

import (
	"github.com/blevesearch/bleve/v2/analysis/analyzer/custom"
	"github.com/blevesearch/bleve/v2/analysis/token/edgengram"
	"github.com/blevesearch/bleve/v2/analysis/token/lowercase"
	"github.com/blevesearch/bleve/v2/analysis/token/ngram"
	"github.com/blevesearch/bleve/v2/analysis/token/unique"
	"github.com/blevesearch/bleve/v2/analysis/tokenizer/whitespace"
	"github.com/blevesearch/bleve/v2/mapping"
)

const TITLE_ANALYZER = "title_analyzer"
const EDGE_NGRAM_MIN_TOKEN = 3.0
const tokenFilterName = "ngram_filter"

func RegisterCustomAnalyzers(mapper *mapping.IndexMappingImpl, useFullNgram bool) error {
	return registerTitleAnalyzer(mapper, useFullNgram)
}

// The registerTitleAnalyzer function defines a custom analyzer using edge n-gram or full n-gram
func registerTitleAnalyzer(mapper *mapping.IndexMappingImpl, useFullNgram bool) error {
	// The edgengram tokenFilter will create grams anchored to the front of each token.
	// For example, the token "hello" will be tokenized into "hel", "hell", "hello".
	tokenFilter := map[string]interface{}{
		"type": edgengram.Name,
		"min":  EDGE_NGRAM_MIN_TOKEN,
		"max":  10.0,
		"back": edgengram.FRONT,
	}

	if useFullNgram {
		// The ngram tokenFilter will create additional grams in the middle of each token.
		// For example, the token "hello" will be tokenized into "hel", "hell", "hello", "ell", "ello", "llo".
		tokenFilter = map[string]interface{}{
			"type": ngram.Name,
			"min":  EDGE_NGRAM_MIN_TOKEN,
			"max":  10.0,
		}
	}
	err := mapper.AddCustomTokenFilter(tokenFilterName, tokenFilter)
	if err != nil {
		return err
	}

	//Create a custom analyzer using the N-Gram tokenizer
	ngramAnalyzer := map[string]interface{}{
		"type":          custom.Name,
		"tokenizer":     whitespace.Name,
		"token_filters": []string{tokenFilterName, lowercase.Name, unique.Name},
		//"char_filters":  //TODO IF NEEDED
	}

	err = mapper.AddCustomAnalyzer(TITLE_ANALYZER, ngramAnalyzer)
	if err != nil {
		return err
	}

	return nil
}
