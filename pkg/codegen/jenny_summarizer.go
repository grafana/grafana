package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
)

// SummarizerJenny generates a gateway func named Summarizer in each core kind's
// backend kind directory.
func SummarizerJenny(path string) OneToOne {
	return summarizerJenny{
		parentpath: path,
	}
}

type summarizerJenny struct {
	parentpath string
}

func (j summarizerJenny) JennyName() string {
	return "SummarizerJenny"
}

func (j summarizerJenny) Generate(decl *DeclForGen) (*codejen.File, error) {
	if decl.IsComposable() {
		return nil, nil
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("kindgate_summary.tmpl").Execute(buf, decl); err != nil {
		return nil, fmt.Errorf("failed executing kind summary template: %w", err)
	}

	path := filepath.Join(j.parentpath, decl.Properties.Common().MachineName, "summary_gen.go")
	b, err := postprocessGoFile(genGoFile{
		path: path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(path, b, j), nil
}
