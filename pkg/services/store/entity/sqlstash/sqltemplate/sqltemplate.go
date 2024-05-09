package sqltemplate

import (
	"regexp"
	"strings"
	"text/template"
)

// Execute is a trivial utility to execute and return the results of any
// text/template as a string and an error. Additionally, it removes excess white
// space to provide a more compact output.
// NOTE: string literals and identifiers containing white space other than the
// regular space character (U+0020), chains of more than one of any white
// space character, and SQL line comments will be affected. If you really need
// any of that, do not use this function, but first consider these options:
//  1. Always pass string literals as arguments, which will also ensure they are
//     properly escaped.
//  2. Use template comments instead of SQL comments, which will still provide
//     correct documentation, but will not send comments to be executed to the
//     database server.
//  3. Use better identifiers, ideally without any white space at all. While the
//     identifier-escaping helpers provided in this package will correctly
//     handle any identifier, even those with white space, it still reads poorly
//     and it is considered a bad practice.
func Execute(t *template.Template, data any) (string, error) {
	var b strings.Builder
	if err := t.Execute(&b, data); err != nil {
		return "", err
	}

	return stripWhiteSpace(b.String()), nil
}

var whiteSpaceRE = regexp.MustCompile(`\s+`)

func stripWhiteSpace(q string) string {
	return strings.TrimSpace(whiteSpaceRE.ReplaceAllString(q, " "))
}
