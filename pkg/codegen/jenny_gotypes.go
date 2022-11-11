package codegen

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/gocode"
	"golang.org/x/tools/go/ast/astutil"
)

// GoTypesJenny creates a [OneToOne] that produces Go types for the latest
// Thema schema in a structured kind's lineage.
//
// At minimum, a gokindsdir must be provided. This should be the path to the parent
// directory of the directory in which the types should be generated, relative
// to the project root. For example, if the types for a kind named "foo"
// should live at pkg/kind/foo/foo_gen.go, relpath should be "pkg/kind".
//
// This generator is a no-op for raw kinds.
func GoTypesJenny(gokindsdir string, cfg *GoTypesGeneratorConfig) OneToOne {
	if cfg == nil {
		cfg = new(GoTypesGeneratorConfig)
	}
	if cfg.GenDirName == nil {
		cfg.GenDirName = func(decl *DeclForGen) string {
			return decl.Meta.Common().MachineName
		}
	}

	return &genGoTypes{
		gokindsdir: gokindsdir,
		cfg:        cfg,
	}
}

// GoTypesGeneratorConfig holds configuration options for [GoTypesJenny].
type GoTypesGeneratorConfig struct {
	// Apply is an optional AST manipulation func that, if provided, will be run
	// against the generated Go file prior to running it through goimports.
	Apply astutil.ApplyFunc

	// GenDirName returns the name of the parent directory in which the type file
	// should be generated. If nil, the DeclForGen.Lineage().Name() will be used.
	GenDirName func(*DeclForGen) string

	// Version of the schema to generate. If nil, latest is generated.
	Version *thema.SyntacticVersion
}

type genGoTypes struct {
	gokindsdir string
	cfg        *GoTypesGeneratorConfig
}

func (gen *genGoTypes) JennyName() string {
	return "GoTypesJenny"
}

func (gen *genGoTypes) Generate(decl *DeclForGen) (*codejen.File, error) {
	if decl.IsRaw() {
		return nil, nil
	}

	var sch thema.Schema
	var err error

	lin := decl.Lineage()
	if gen.cfg.Version == nil {
		sch = lin.Latest()
	} else {
		sch, err = lin.Schema(*gen.cfg.Version)
		if err != nil {
			return nil, fmt.Errorf("error in configured version for %s generator: %w", *gen.cfg.Version, err)
		}
	}

	// always drop prefixes.
	var appf []astutil.ApplyFunc
	if gen.cfg.Apply != nil {
		appf = append(appf, gen.cfg.Apply)
	}
	appf = append(appf, PrefixDropper(decl.Meta.Common().Name))

	pdir := gen.cfg.GenDirName(decl)
	fpath := filepath.Join(gen.gokindsdir, pdir, lin.Name()+"_types_gen.go")
	// TODO allow using name instead of machine name in thema generator
	b, err := gocode.GenerateTypesOpenAPI(sch, &gocode.TypeConfigOpenAPI{
		PackageName: filepath.Base(pdir),
		ApplyFuncs:  appf,
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(fpath, b, gen), nil
}
