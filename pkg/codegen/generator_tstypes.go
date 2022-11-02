package codegen

import (
	"path/filepath"

	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/typescript"
)

// TSTypesGenerator creates a [KindGenStep] that produces TypeScript types and
// defaults for the latest Thema schema in a structured kind's lineage.
//
// At minimum, a tskindsdir must be provided. This should be the path to the parent
// directory of the directory in which the types should be generated, relative
// to the project root. For example, if the types for a kind named "foo"
// should live at packages/grafana-schema/src/raw/foo, relpath should be "pkg/kind".
//
// This generator is a no-op for raw kinds.
func TSTypesGenerator(tskindsdir string, cfg *TSTypesGeneratorConfig) KindGenStep {
	if cfg == nil {
		cfg = new(TSTypesGeneratorConfig)
	}
	if cfg.GenDirName == nil {
		cfg.GenDirName = func(decl *DeclForGen) string {
			return machineNameFor(decl.Meta)
		}
	}
	if cfg.IsGroup == nil {
		cfg.IsGroup = func(decl *DeclForGen) bool {
			return false
		}
	}

	return &genTSTypes{
		tskindsdir: tskindsdir,
		cfg:        cfg,
	}
}

type TSTypesGeneratorConfig struct {
	// GenDirName returns the name of the parent directory in which the type file
	// should be generated. If nil, the DeclForGen.Lineage().Name() will be used.
	GenDirName func(*DeclForGen) string

	// IsGroup indicates whether the kind is a group lineage or not. See
	// [typescript.TypeConfig].
	IsGroup func(*DeclForGen) bool
}

type genTSTypes struct {
	tskindsdir string
	cfg        *TSTypesGeneratorConfig
}

func (gen *genTSTypes) Name() string {
	return "TSTypesGenerator"
}

func (gen *genTSTypes) Generate(decl *DeclForGen) (*GeneratedFile, error) {
	if decl.IsRaw() {
		return nil, nil
	}

	lin := decl.Lineage()
	sch := thema.SchemaP(lin, thema.LatestVersion(lin))
	// TODO allow using name instead of machine name in thema generator
	f, err := typescript.GenerateTypes(sch, &typescript.TypeConfig{
		RootName: nameFor(decl.Meta),
		Group:    gen.cfg.IsGroup(decl),
	})
	if err != nil {
		return nil, err
	}
	return &GeneratedFile{
		RelativePath: filepath.Join(gen.tskindsdir, gen.cfg.GenDirName(decl), lin.Name()+"_types.gen.ts"),
		Data:         []byte(f.String()),
	}, nil
}

// var _ KindGenStep = &genTSTypes{}
