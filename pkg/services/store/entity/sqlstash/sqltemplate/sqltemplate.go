package sqltemplate

import (
	"regexp"
	"strings"
	"text/template"
)

// SQLTemplate provides comprehensive support for SQL templating, handling
// dialect traits, execution arguments and scanning arguments.
type SQLTemplate struct {
	Dialect
	Args
	ScanDest
}

// New returns a nee *SQLTemplate that will use the given dialect.
func New(d Dialect) *SQLTemplate {
	return &SQLTemplate{
		Dialect: d,
	}
}

// SQLTemplateIface can be used as argument in general purpose utilities
// expecting a struct embedding *SQLTemplate.
type SQLTemplateIface interface {
	Dialect
	ArgsIface
	ScanDestIface
}

// WithResults has an additional method suited for structs embedding
// *SQLTemplate and returning a set of rows.
type WithResults[T any] interface {
	SQLTemplateIface

	// Results returns the results of the query. If the query is expected to
	// return a set of rows, then it should be a deep copy of the internal
	// results, so that it can be called multiple times to get the different
	// values.
	Results() (T, error)
}

// Execute is a trivial utility to execute and return the results of any
// text/template as a string and an error.
func Execute(t *template.Template, data any) (string, error) {
	var b strings.Builder
	if err := t.Execute(&b, data); err != nil {
		return "", err
	}

	return b.String(), nil
}

// FormatSQL is an opinionated formatter for SQL template output that returns
// the code as a oneliner. It can be used to reduce the final code length, for
// debugging, and testing. It is not a propoer and full-fledged SQL parser, so
// it makes the following assumptions, which are also good practices for writing
// your SQL templates:
//  1. There are no SQL comments. Consider adding your comments as template
//     comments instead (i.e. "{{/* this is a template comment */}}").
//  2. There are no multiline strings, and strings do not contain consecutive
//     spaces. Code looking like this is already a smell. Avoid string literals,
//     pass them as arguments so they can be appropriately escaped by the
//     corresponding driver. And identifiers with white space should be avoided
//     in all cases as well.
func FormatSQL(q string) string {
	q = strings.TrimSpace(q)
	for _, f := range formatREs {
		q = f.re.ReplaceAllString(q, f.replacement)
	}

	return q
}

type reFormatting struct {
	re          *regexp.Regexp
	replacement string
}

var formatREs = []reFormatting{
	{re: regexp.MustCompile(`\s+`), replacement: " "},
	{re: regexp.MustCompile(` ?([+-/*=<>%!~]+) ?`), replacement: " $1 "},
	{re: regexp.MustCompile(`([([{]) `), replacement: "$1"},
	{re: regexp.MustCompile(` ([)\]}])`), replacement: "$1"},
	{re: regexp.MustCompile(` ?, ?`), replacement: ", "},
	{re: regexp.MustCompile(` ?([;.:]) ?`), replacement: "$1"},
}
