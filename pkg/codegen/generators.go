package codegen

import (
	"bytes"
	"fmt"
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
			return decl.Name()
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
		RelativePath: filepath.Join(gen.relroot, pdir, lin.Name()+"_types_gen.go"),
		Data:         b,
	}, nil
}

type genBaseRegistry struct {
	path        string
	kindrelroot string
}

var _ AggregateKindGenStep = &genBaseRegistry{}

// BaseCoreRegistryGenerator generates a static registry for core kinds that
// is only initializes their [kind.Interface]. No slot kinds are composed.
//
// Path should be the relative path to the directory that will contain the
// generated registry. kindrelroot should be the repo-root-relative path to the
// parent directory to all directories that contain generated kind bindings
// (e.g. pkg/kind).
func BaseCoreRegistryGenerator(path, kindrelroot string) AggregateKindGenStep {
	return &genBaseRegistry{
		path:        path,
		kindrelroot: kindrelroot,
	}
}

func (gen *genBaseRegistry) Name() string {
	return "BaseCoreRegistryGenerator"
}

func (gen *genBaseRegistry) Generate(decls []*DeclForGen) (*GeneratedFile, error) {
	var numRaw int
	for _, k := range decls {
		if k.IsRaw() {
			numRaw++
		}
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("kind_registry.tmpl").Execute(buf, tvars_kind_registry{
		NumRaw:            numRaw,
		NumStructured:     len(decls) - numRaw,
		PackageName:       filepath.Base(gen.path),
		KindPackagePrefix: filepath.ToSlash(filepath.Join("github.com/grafana/grafana", gen.kindrelroot)),
		Kinds:             decls,
	}); err != nil {
		return nil, fmt.Errorf("failed executing kind registry template: %w", err)
	}

	b, err := postprocessGoFile(genGoFile{
		path: gen.path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	return &GeneratedFile{
		RelativePath: filepath.Join(gen.path, "base_gen.go"),
		Data:         b,
	}, nil
}
