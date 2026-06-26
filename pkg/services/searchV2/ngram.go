package searchV2

import (
	"strings"

	"github.com/blugelabs/bluge/analysis"
	"github.com/blugelabs/bluge/analysis/token"
	"github.com/blugelabs/bluge/analysis/tokenizer"
)

var punctuationReplacer *strings.Replacer

func init() {
	var punctuation = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
	args := make([]string, 0, len(punctuation)*2)
	for _, r := range punctuation {
		args = append(args, string(r), " ")
	}
	punctuationReplacer = strings.NewReplacer(args...)
}

type punctuationCharFilter struct{}

func (t *punctuationCharFilter) Filter(input []byte) []byte {
	return []byte(punctuationReplacer.Replace(string(input)))
}

const ngramEdgeFilterMaxLength = 7

var ngramIndexAnalyzer = &analysis.Analyzer{
	CharFilters: []analysis.CharFilter{&punctuationCharFilter{}},
	Tokenizer:   tokenizer.NewWhitespaceTokenizer(),
	TokenFilters: []analysis.TokenFilter{
		token.NewCamelCaseFilter(),
		token.NewLowerCaseFilter(),
		token.NewEdgeNgramFilter(token.FRONT, 1, ngramEdgeFilterMaxLength),
	},
}

var ngramQueryAnalyzer = &analysis.Analyzer{
	CharFilters: []analysis.CharFilter{&punctuationCharFilter{}},
	Tokenizer:   tokenizer.NewWhitespaceTokenizer(),
	TokenFilters: []analysis.TokenFilter{
		token.NewCamelCaseFilter(),
		token.NewLowerCaseFilter(),
	},
}
