package codegen

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/typescript"
	"github.com/grafana/codejen"
)

// TSTypesJenny creates a [OneToOne] that produces TypeScript types and
// defaults for the latest Thema schema in a structured kind's lineage.
//
// At minimum, a tskindsdir must be provided. This should be the path to the parent
// directory of the directory in which the types should be generated, relative
// to the project root. For example, if the types for a kind named "foo"
// should live at packages/grafana-schema/src/raw/foo, relpath should be "pkg/kind".
//
// This generator is a no-op for raw kinds.
func TSTypesJenny(tskindsdir string, cfg *TSTypesGeneratorConfig) OneToOne {
	if cfg == nil {
		cfg = new(TSTypesGeneratorConfig)
	}
	if cfg.GenDirName == nil {
		cfg.GenDirName = func(decl *DeclForGen) string {
			return decl.Meta.Common().MachineName
		}
	}

	return &genTSTypes{
		tskindsdir: tskindsdir,
		cfg:        cfg,
	}
}

// TSTypesGeneratorConfig holds configuration options for [TSTypesJenny].
type TSTypesGeneratorConfig struct {
	// GenDirName returns the name of the parent directory in which the type file
	// should be generated. If nil, the DeclForGen.Lineage().Name() will be used.
	GenDirName func(*DeclForGen) string

	// Version of the schema to generate. If nil, latest is generated.
	Version *thema.SyntacticVersion
}

type genTSTypes struct {
	tskindsdir string
	cfg        *TSTypesGeneratorConfig
}

func (gen *genTSTypes) JennyName() string {
	return "TSTypesJenny"
}

func (gen *genTSTypes) Generate(decl *DeclForGen) (*codejen.File, error) {
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

	// TODO allow using name instead of machine name in thema generator
	f, err := typescript.GenerateTypes(sch, &typescript.TypeConfig{
		RootName: decl.Meta.Common().Name,
		Group:    decl.Meta.Common().LineageIsGroup,
	})
	if err != nil {
		return nil, err
	}
	return codejen.NewFile(
		filepath.Join(gen.tskindsdir, gen.cfg.GenDirName(decl), lin.Name()+"_types.gen.ts"),
		[]byte(f.String()),
		gen), nil
}
