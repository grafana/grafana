package sqltemplatetest

import (
	"bufio"
	"errors"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Package-level errors.
var (
	ErrInvalidSQL = errors.New("invalid SQL string")
)

// SQLEq can be used to compare a SQL string previously known to be correct with
// a string potentially generated from a SQL template. This function can be
// used standalone or as a sqlmock.QueryMatcherFunc. Avoid the following two in
// both strings:
//  1. Using SQL string literals (only identifier quoting is supported).
//  2. Using SQL comments.
//
// If you need either of the two above, consider a different comparison function
// (package sqlmock provides other options). SQL generated from templates should
// not have either of them, since it's expected that string literals are passed
// as arguments with a "?" placeholder so that the corresponding driver can
// correctly escape the string, and comments should be template comments instead
// to leave the final code clean.
//
// See:
//
//	https://pkg.go.dev/github.com/DATA-DOG/go-sqlmock
func SQLEq(expectedSQL, actualSQL string) error {
	expectedSQL, err := StripSQLLike(expectedSQL)
	if err != nil {
		return fmt.Errorf("strip expectedSQL: %w", err)
	}

	actualSQL, err = StripSQLLike(actualSQL)
	if err != nil {
		return fmt.Errorf("strip actualSQL: %w", err)
	}

	if expectedSQL != actualSQL {
		return fmt.Errorf("SQL not matching:\n\texpected: %s\n\n\tgot:      %s\n",
			expectedSQL, actualSQL)
	}

	return nil
}

// StripSQLLike formats the provided string as if it was SQL code. The following
// should be avoided:
// Assumtions:
//  1. Using SQL string literals (only identifier quoting is allowed).
//  2. Using SQL comments.
//
// If you need either of the two above, consider a different formatting
// function. SQL generated from templates should not have either of them, since
// it's expected that string literals are passed as arguments with a "?"
// placeholder so that the corresponding driver can correctly escape the string,
// and comments should be template comments instead to leave the final code
// clean.
func StripSQLLike(s string) (string, error) {
	scanner := bufio.NewScanner(strings.NewReader(s))
	scanner.Split(split)

	var buf strings.Builder
	for scanner.Scan() {
		if buf.Len() > 0 {
			buf.Write([]byte{' '})
		}
		buf.Write(scanner.Bytes())
	}

	if err := scanner.Err(); err != nil {
		return "", err
	}

	return buf.String(), nil
}

func split(data []byte, atEOF bool) (advance int, token []byte, err error) {
	var r rune

	// Skip leading spaces.
	start := 0
	for width := 0; start < len(data); start += width {
		r, width = utf8.DecodeRune(data[start:])
		if !unicode.IsSpace(r) {
			break
		}
	}

	// Discard data with pure spaces.
	if start == len(data) {
		return len(data), nil, nil
	}

	if isQuote(rune(data[start])) {
		// Return quoted data as a token, allowing for double quotes to escape
		// the quoting character itself.
		quote := rune(data[start])

		var seenQuote bool
		for width, i := 0, start+1; i < len(data); i += width {
			r, width = utf8.DecodeRune(data[i:])
			if r == quote {
				if !seenQuote {
					seenQuote = true
					continue
				}

			} else if seenQuote {
				if unicode.IsSpace(r) || (unicode.IsPunct(r) && !isQuote(r)) {
					return i, data[start:i], nil
				}
				return 0, nil, ErrInvalidSQL
			}
			seenQuote = false
		}

		if atEOF {
			if seenQuote {
				return len(data), data[start:], nil
			}
			return 0, nil, ErrInvalidSQL
		}

	} else if data[start] != '_' && unicode.IsPunct(rune(data[start])) {
		// A punctuation character other than underscore is treated as a token.
		return start + 1, data[start : start+1], nil

	} else {
		// The rest is treated as a "word"

		// Scan until space, marking end of word.
		for width, i := 0, start; i < len(data); i += width {
			r, width = utf8.DecodeRune(data[i:])
			if isQuote(r) {
				return 0, nil, ErrInvalidSQL
			}
			if unicode.IsSpace(r) || (unicode.IsPunct(r) && r != '_') {
				return i, data[start:i], nil
			}
		}

		// If we're at EOF, we have a final, non-empty, non-terminated word.
		// Return it.
		if atEOF && len(data) > start {
			return len(data), data[start:], nil
		}
	}

	// Request more data.
	return start, nil, nil
}

func isQuote(b rune) bool {
	return b == '\'' || b == '"' || b == '`'
}
