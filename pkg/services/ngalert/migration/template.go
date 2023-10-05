// This file contains code that parses templates from old alerting into a sequence
// of tokens. Each token can be either a string literal or a variable.

package migration

import (
	"bytes"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/state/template"
)

// Token contains either a string literal or a variable.
type Token struct {
	Literal  string
	Variable string
}

func (t Token) IsLiteral() bool {
	return t.Literal != ""
}

func (t Token) IsVariable() bool {
	return t.Variable != ""
}

func (t Token) String() string {
	if t.IsLiteral() {
		return t.Literal
	} else if t.IsVariable() {
		return t.Variable
	} else {
		panic("empty token")
	}
}

func MigrateTmpl(l log.Logger, oldTmpl string) string {
	var newTmpl string

	tokens := tokenizeTmpl(l, oldTmpl)
	tokens = escapeLiterals(tokens)

	if anyVariableToken(tokens) {
		tokens = variablesToMapLookups(tokens, "mergedLabels")
		newTmpl += fmt.Sprintf("{{- $mergedLabels := %s $values -}}\n", template.MergeLabelValuesFuncName)
	}

	newTmpl += tokensToTmpl(tokens)
	return newTmpl
}

func tokenizeTmpl(logger log.Logger, tmpl string) []Token {
	var (
		tokens []Token
		l      int
		r      int
		err    error
	)

	in := []rune(tmpl)
	for r < len(in) {
		if !startVariable(in[r:]) {
			r++
			continue
		}

		token, offset, tokenErr := tokenizeVariable(in[r:])
		if tokenErr != nil {
			err = errors.Join(err, tokenErr)
			r += offset
			continue
		}

		// we've found a variable, so everything from l -> r is the literal before the variable
		// ex: "foo ${bar}" -> Literal: "foo ", Variable: "bar"
		if r > l {
			tokens = append(tokens, Token{Literal: string(in[l:r])})
		}
		tokens = append(tokens, token)

		// seek l and r past the variable
		r += offset
		l = r
	}

	// any remaining runes will be a final literal
	if r > l {
		tokens = append(tokens, Token{Literal: string(in[l:r])})
	}

	if err != nil {
		logger.Warn("Encountered malformed template", "template", tmpl, "err", err)
	}

	return tokens
}

func tokenizeVariable(in []rune) (Token, int, error) {
	var (
		pos   int
		r     rune
		runes []rune
	)

	if !startVariable(in) {
		panic("tokenizeVariable called with input that doesn't start with delimiter")
	}
	pos += 2 // seek past opening delimiter

	// consume valid runes until we hit a closing brace
	// non-space whitespace and the opening delimiter are invalid
	for pos < len(in) {
		r = in[pos]

		if unicode.IsSpace(r) && r != ' ' {
			return Token{}, pos, fmt.Errorf("unexpected whitespace")
		}

		if startVariable(in[pos:]) {
			return Token{}, pos, fmt.Errorf("ambiguous delimiter")
		}

		if r == '}' {
			pos++
			break
		}

		runes = append(runes, r)
		pos++
	}

	// variable must end with '}' delimiter
	if r != '}' {
		return Token{}, pos, fmt.Errorf("expected '}', got '%c'", r)
	}

	return Token{Variable: string(runes)}, pos, nil
}

func startVariable(in []rune) bool {
	return len(in) >= 2 && in[0] == '$' && in[1] == '{'
}

func anyVariableToken(tokens []Token) bool {
	for _, token := range tokens {
		if token.IsVariable() {
			return true
		}
	}
	return false
}

// tokensToTmpl returns the tokens as a Go template
func tokensToTmpl(tokens []Token) string {
	buf := bytes.Buffer{}
	for _, token := range tokens {
		if token.IsVariable() {
			buf.WriteString("{{")
			buf.WriteString(token.String())
			buf.WriteString("}}")
		} else {
			buf.WriteString(token.String())
		}
	}
	return buf.String()
}

// escapeLiterals escapes any token literals with substrings that would be interpreted as Go template syntax
func escapeLiterals(tokens []Token) []Token {
	result := make([]Token, 0, len(tokens))
	for _, token := range tokens {
		if token.IsLiteral() && shouldEscape(token.Literal) {
			token.Literal = fmt.Sprintf("{{`%s`}}", token.Literal)
		}
		result = append(result, token)
	}
	return result
}

func shouldEscape(literal string) bool {
	return strings.Contains(literal, "{{") || literal[len(literal)-1] == '{'
}

// variablesToMapLookups converts any variables in a slice of tokens to Go template map lookups
func variablesToMapLookups(tokens []Token, mapName string) []Token {
	result := make([]Token, 0, len(tokens))
	for _, token := range tokens {
		if token.IsVariable() {
			token.Variable = mapLookupString(token.Variable, mapName)
		}
		result = append(result, token)
	}
	return result
}

func mapLookupString(v string, mapName string) string {
	for _, r := range v {
		if !(unicode.IsDigit(r) || unicode.IsLetter(r) || r == '_') {
			return fmt.Sprintf(`index $%s %s`, mapName, strconv.Quote(v)) // quote v to escape any special characters
		}
	}
	return fmt.Sprintf(`$%s.%s`, mapName, v)
}
