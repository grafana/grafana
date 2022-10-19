package codegen

import (
	"path/filepath"

	"github.com/grafana/grafana/pkg/framework/kind"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/tgo"
	"golang.org/x/tools/go/ast/astutil"
)

func nameFor(m kind.SomeKindMeta) string {
	switch x := m.(type) {
	case kind.RawMeta:
		return x.Name
	case kind.CoreStructuredMeta:
		return x.Name
	case kind.CustomStructuredMeta:
		return x.Name
	case kind.SlotImplMeta:
		return x.Name
	default:
		// unreachable so long as all the possibilities in KindMetas have switch branches
		panic("unreachable")
	}
}

type genGoTypes struct {
	relroot string
	cfg     *GenGoTypesConfig
}

var _ KindGenStep = &genGoTypes{}

// TODO docs
type genThemaBindings struct{}

// var _ KindGenStep = &genThemaBindings{}

// TODO docs
type genBaseRegistry struct{}

// var _ AggregateKindGenStep = &genBaseRegistry{}

// TODO docs
type genTSTypes struct{}

// var _ KindGenStep = &genTSTypes{}

// TODO docs
type genTSSchemaIndex struct{}

// var _ AggregateKindGenStep = &genTSSchemaIndex{}

// genGoServiceRefs generates a file within the service directory for a
// structured kind with predictably-named type aliases to the kind's generated
// Go types.
type genGoServiceRefs struct{}

// var _ KindGenStep = &genGoServiceRefs{}

type GenGoTypesConfig struct {
	// Apply is an optional AST manipulation func that, if provided, will be run
	// against the generated Go file prior to running it through goimports.
	Apply astutil.ApplyFunc

	// GenDirName returns the name of the parent directory in which the type file
	// should be generated. If nil, the DeclForGen.Lineage().Name() will be used.
	GenDirName func(*DeclForGen) string
}

// GoTypesGenerator creates a [KindGenStep] that produces Go types for the latest
// Thema schema in a structured kind's lineage.
//
// At minimum, a relroot must be provided. This should be the path to the parent
// directory of the directory in which the types should be generated, relative
// to the project root. For example, if the types for a kind named "foo"
// should live at pkg/kind/foo/foo_gen.go, relpath should be "pkg/kind".
//
// This generator is a no-op for raw kinds.
func GoTypesGenerator(relroot string, cfg *GenGoTypesConfig) KindGenStep {
	if cfg == nil {
		cfg = new(GenGoTypesConfig)
	}
	if cfg.GenDirName == nil {
		cfg.GenDirName = func(decl *DeclForGen) string {
			return nameFor(decl.Meta)
		}
	}

	return &genGoTypes{
		relroot: relroot,
		cfg:     cfg,
	}
}

func (gen *genGoTypes) Name() string {
	return "GoTypesGenerator"
}

func (gen *genGoTypes) Generate(decl *DeclForGen) (*GeneratedFile, error) {
	if decl.IsRaw() {
		return nil, nil
	}

	lin := decl.Lineage()
	sch := thema.SchemaP(lin, thema.LatestVersion(lin))
	pdir := gen.cfg.GenDirName(decl)
	b, err := tgo.GenerateTypesOpenAPI(sch, &tgo.TypeConfigOpenAPI{
		PackageName: filepath.Base(pdir),
		Apply:       gen.cfg.Apply,
	})
	if err != nil {
		return nil, err
	}
	return &GeneratedFile{
		RelativePath: filepath.Join(gen.relroot, pdir),
		Data:         b,
	}, nil
}
