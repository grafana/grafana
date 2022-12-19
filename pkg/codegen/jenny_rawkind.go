package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
)

// RawKindJenny generates the implementation of [kindsys.Raw] for the
// provided kind declaration.
//
// gokindsdir should be the relative path to the parent directory that contains
// all generated kinds.
//
// This generator only has output for raw kinds.
func RawKindJenny(gokindsdir string, cfg *RawKindGeneratorConfig) OneToOne {
	if cfg == nil {
		cfg = new(RawKindGeneratorConfig)
	}
	if cfg.GenDirName == nil {
		cfg.GenDirName = func(decl *DeclForGen) string {
			return decl.Properties.Common().MachineName
		}
	}

	return &genRawKind{
		gokindsdir: gokindsdir,
		cfg:        cfg,
	}
}

type genRawKind struct {
	gokindsdir string
	cfg        *RawKindGeneratorConfig
}

type RawKindGeneratorConfig struct {
	// GenDirName returns the name of the directory in which the file should be
	// generated. Defaults to DeclForGen.Lineage().Name() if nil.
	GenDirName func(*DeclForGen) string
}

func (gen *genRawKind) JennyName() string {
	return "RawKindJenny"
}

func (gen *genRawKind) Generate(decl *DeclForGen) (*codejen.File, error) {
	if !decl.IsRaw() {
		return nil, nil
	}

	path := filepath.Join(gen.gokindsdir, gen.cfg.GenDirName(decl), decl.Properties.Common().MachineName+"_kind_gen.go")
	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("kind_raw.tmpl").Execute(buf, decl); err != nil {
		return nil, fmt.Errorf("failed executing kind_raw template for %s: %w", path, err)
	}
	b, err := postprocessGoFile(genGoFile{
		path: path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(path, b, gen), nil
}
