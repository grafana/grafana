package sqltemplatetest

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"text/template"
)

// Package-level errors.
var (
	ErrExecuteTemplate = errors.New("execeute query failed")
	ErrUnexpectedQuery = errors.New("unexpected query")
)

// Golden provides a simple way to execute golden tests on SQL templates. The
// SQL code is compared removing excess white space, but beware of white space
// at word boundaries if you're manually crafting the expected SQL.
func Golden(tmpl *template.Template, expectedSQL string, data any) error {
	var b strings.Builder
	err := tmpl.Execute(&b, data)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrExecuteTemplate, err)
	}

	query := stripWhiteSpace(b.String())
	expectedSQL = stripWhiteSpace(expectedSQL)

	if expectedSQL != query {
		return fmt.Errorf("%w:\n\tExpected:\n\t\t%s\n\n\tGot:\n\t\t%v",
			ErrUnexpectedQuery, expectedSQL, query)
	}

	return nil
}

// Just a few lines of trivial copying from sqltemplate to avoid importing.

var whiteSpaceRE = regexp.MustCompile(`\s+`)

func stripWhiteSpace(q string) string {
	return strings.TrimSpace(whiteSpaceRE.ReplaceAllString(q, " "))
}
