package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
)

// CoreStructuredKindJenny generates the implementation of
// [kindsys.Structured] for the provided kind declaration.
//
// gokindsdir should be the relative path to the parent directory that contains
// all generated kinds.
//
// This generator only has output for core structured kinds.
func CoreStructuredKindJenny(gokindsdir string, cfg *CoreStructuredKindGeneratorConfig) OneToOne {
	if cfg == nil {
		cfg = new(CoreStructuredKindGeneratorConfig)
	}
	if cfg.GenDirName == nil {
		cfg.GenDirName = func(decl *DeclForGen) string {
			return decl.Meta.Common().MachineName
		}
	}

	return &genCoreStructuredKind{
		gokindsdir: gokindsdir,
		cfg:        cfg,
	}
}

// CoreStructuredKindGeneratorConfig holds configuration options for [CoreStructuredKindJenny].
type CoreStructuredKindGeneratorConfig struct {
	// GenDirName returns the name of the directory in which the file should be
	// generated. Defaults to DeclForGen.Lineage().Name() if nil.
	GenDirName func(*DeclForGen) string
}

type genCoreStructuredKind struct {
	gokindsdir string
	cfg        *CoreStructuredKindGeneratorConfig
}

var _ OneToOne = &genCoreStructuredKind{}

func (gen *genCoreStructuredKind) JennyName() string {
	return "CoreStructuredKindJenny"
}

func (gen *genCoreStructuredKind) Generate(decl *DeclForGen) (*codejen.File, error) {
	if !decl.IsCoreStructured() {
		return nil, nil
	}

	path := filepath.Join(gen.gokindsdir, gen.cfg.GenDirName(decl), decl.Meta.Common().MachineName+"_kind_gen.go")
	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("kind_corestructured.tmpl").Execute(buf, decl); err != nil {
		return nil, fmt.Errorf("failed executing kind_corestructured template for %s: %w", path, err)
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
