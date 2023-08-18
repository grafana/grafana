// This file contains code that parses templates from old alerting into a sequence
// of tokens. Each token can be either a string literal or a variable.

package ualert

import (
	"errors"
	"fmt"
	"unicode"
)

var (
	ErrEOF = errors.New("EOF")
)

// Token contains either a whitespace character, such as a space, tab, or newline;
// a string literal; or a variable.
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

func tokenizeLiteral(in []rune) (Token, int, error) {
	pos := 0

	// consume runes until the first '$' or the end of `in`
	for pos < len(in) {
		if r := in[pos]; r == '$' {
			// don't consume the '$' as this is the start of a variable
			break
		}
		// if there are more runes update pos
		pos = pos + 1
	}

	return Token{Literal: string(in[:pos])}, pos, nil
}

func tokenizeVariable(in []rune) (Token, int, error) {
	var (
		pos   int
		r     rune
		runes []rune
	)

	// variables must start with a $
	r = in[pos]
	if r != '$' {
		return Token{}, pos, fmt.Errorf("expected '$', got '%c'", r)
	}

	// the next rune must be an open brace
	pos = pos + 1
	r = in[pos]
	if r != '{' {
		return Token{}, pos, fmt.Errorf("expected '{', got '%c'", r)
	}

	// consume all runes except for '$', '{', and any non-space whitespace until the closing brace
	pos = pos + 1
	for pos < len(in) {
		r = in[pos]
		if r == '$' || r == '{' {
			return Token{}, pos, fmt.Errorf("unexpected '%c'", r)
		} else if unicode.IsSpace(r) && r != ' ' {
			return Token{}, pos, errors.New("unexpected whitespace")
		} else if r == '}' {
			pos = pos + 1
			break
		} else {
			runes = append(runes, r)
			pos = pos + 1
		}
	}

	// if the last rune is not a closing brace then this is not a valid variable
	if r != '}' {
		return Token{}, pos, fmt.Errorf("expected '}', got '%c'", r)
	}

	// if there is more than one closing brace then this is not a valid variable either
	if pos < len(in) && in[pos] == '}' {
		return Token{}, pos, errors.New("unexpected '}'")
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
		} else {
			token, offset, err = tokenizeLiteral(in[pos:])
		}
		if err != nil {
			return tokens, fmt.Errorf("error tokenizing template at position %d: %w", pos, err)
		}
		tokens = append(tokens, token)
		pos = pos + offset
	}

	return tokens, nil
}
