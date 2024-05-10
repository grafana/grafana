package sqltemplate

import (
	"strings"
	"text/template"
)

type SQLTemplate struct {
	Dialect
	Args
	ScanDest
}

func New(d Dialect) *SQLTemplate {
	return &SQLTemplate{
		Dialect: d,
	}
}

type SQLTemplateIface interface {
	Dialect
	GetArgs() Args
	GetScanDest() ScanDest
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
