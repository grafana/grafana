package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
)

// CoreKindJenny generates the implementation of [kindsys.Core] for the provided
// kind declaration.
//
// gokindsdir should be the relative path to the parent directory that contains
// all generated kinds.
//
// This generator only has output for core structured kinds.
func CoreKindJenny(gokindsdir string, cfg *CoreKindJennyConfig) OneToOne {
	if cfg == nil {
		cfg = new(CoreKindJennyConfig)
	}
	if cfg.GenDirName == nil {
		cfg.GenDirName = func(decl *DeclForGen) string {
			return decl.Properties.Common().MachineName
		}
	}

	return &coreKindJenny{
		gokindsdir: gokindsdir,
		cfg:        cfg,
	}
}

// CoreKindJennyConfig holds configuration options for [CoreKindJenny].
type CoreKindJennyConfig struct {
	// GenDirName returns the name of the directory in which the file should be
	// generated. Defaults to DeclForGen.Lineage().Name() if nil.
	GenDirName func(*DeclForGen) string
}

type coreKindJenny struct {
	gokindsdir string
	cfg        *CoreKindJennyConfig
}

var _ OneToOne = &coreKindJenny{}

func (gen *coreKindJenny) JennyName() string {
	return "CoreKindJenny"
}

func (gen *coreKindJenny) Generate(decl *DeclForGen) (*codejen.File, error) {
	if !decl.IsCore() {
		return nil, nil
	}

	path := filepath.Join(gen.gokindsdir, gen.cfg.GenDirName(decl), decl.Properties.Common().MachineName+"_kind_gen.go")
	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("kind_core.tmpl").Execute(buf, decl); err != nil {
		return nil, fmt.Errorf("failed executing kind_core template for %s: %w", path, err)
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
