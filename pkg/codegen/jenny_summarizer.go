package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
)

type SummarizerJenny struct{}

func (j SummarizerJenny) JennyName() string {
	return "SummarizerJenny"
}

func (j SummarizerJenny) Generate(decl *DeclForGen) (*codejen.File, error) {
	if decl.IsComposable() {
		return nil, nil
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("kindgate_summary.tmpl").Execute(buf, decl); err != nil {
		return nil, fmt.Errorf("failed executing kind summary template: %w", err)
	}

	// FIXME ugh path hardcoding
	path := filepath.Join("pkg", "services", "store", "kind", decl.Properties.Common().MachineName, "summary_gen.go")
	b, err := postprocessGoFile(genGoFile{
		path: path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(path, b, j), nil
}
