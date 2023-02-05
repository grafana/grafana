// This file contains code that parses templates from old alerting into a sequence
// of tokens. Each token can be either a literal or a variable.

package ualert

import (
	"errors"
	"fmt"
	"unicode"
)

var (
	EOF = errors.New("EOF")
)

// Token contains either a string literal or a variable.
type Token struct {
	Space    rune
	Literal  string
	Variable string
}

func (t Token) String() string {
	if t.Space > 0 {
		return string(t.Space)
	} else if len(t.Literal) > 0 {
		return t.Literal
	} else {
		return t.Variable
	}
}

func tokenizeLiteral(in []rune) (Token, int, error) {
	var (
		pos   int
		r     rune
		runes []rune
	)
	// consume leading spaces
	for pos < len(in) {
		if r = in[pos]; unicode.IsSpace(r) {
			pos = pos + 1
		} else {
			break
		}
	}
	// consume runes until the first dollar or the end of in
	for pos < len(in) {
		if r = in[pos]; r == '$' {
			// don't consume the dollar as this is the start of a variable
			break
		}
		runes = append(runes, r)
		// if there are more runes update pos
		pos = pos + 1
	}
	// remove trailing spaces and rewind pos
	for i := len(runes) - 1; i > 0; i-- {
		if unicode.IsSpace(runes[i]) {
			runes = runes[0:i]
			pos = pos - 1
		} else {
			break
		}
	}
	return Token{Literal: string(runes)}, pos, nil
}

func tokenizeSpace(in []rune) (Token, int, error) {
	if len(in) > 0 && unicode.IsSpace(in[0]) {
		return Token{Space: in[0]}, 1, nil
	}
	return Token{}, 0, EOF
}

func tokenizeVariable(in []rune) (Token, int, error) {
	var (
		pos   int
		r     rune
		runes []rune
	)
	// consume leading spaces
	for pos < len(in) {
		if r = in[pos]; unicode.IsSpace(r) {
			pos = pos + 1
		} else {
			break
		}
	}
	// variables must start with a $
	r = in[pos]
	if r != '$' {
		return Token{}, pos, fmt.Errorf("expected $, got %c", r)
	}

	// the next character must be an open brace
	pos = pos + 1
	r = in[pos]
	if r != '{' {
		return Token{}, pos, fmt.Errorf("expected opening {, got %c", r)
	}

	// consume all letters, numbers and undercores until the closing brace
	pos = pos + 1
	for pos < len(in) {
		if r = in[pos]; unicode.IsLetter(r) || unicode.IsNumber(r) || r == '_' {
			runes = append(runes, r)
			pos = pos + 1
		} else if r == '}' {
			pos = pos + 1
			break
		} else {
			return Token{}, pos, fmt.Errorf("expected letter, number or underscore, got %c", r)
		}
	}

	// if the last character was not a closing brace, then this is not a valid variable
	if r != '}' {
		return Token{}, pos, fmt.Errorf("expected closing }, got %c", r)
	}

	return Token{Variable: string(runes)}, pos, nil
}

func tokenizeTmpl(tmpl string) ([]Token, error) {
	var (
		in     []rune
		err    error
		offset int
		pos    int
		r      rune
		tokens []Token
		token  Token
	)
	in = []rune(tmpl)
	for pos < len(in) {
		r = in[pos]
		if r == '$' {
			token, offset, err = tokenizeVariable(in[pos:])
		} else if unicode.IsSpace(r) {
			token, offset, err = tokenizeSpace(in[pos:])
		} else {
			token, offset, err = tokenizeLiteral(in[pos:])
		}
		if err != nil {
			return tokens, err
		}
		tokens = append(tokens, token)
		pos = pos + offset
	}
	// remove the last tokens if spaces
	for i := len(tokens) - 1; i > 0; i-- {
		if tokens[i].Space > 0 {
			tokens = tokens[0:i]
		} else {
			break
		}
	}
	return tokens, nil
}
