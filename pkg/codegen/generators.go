package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/tgo"
	"golang.org/x/tools/go/ast/astutil"
)

func machineNameFor(m kindsys.SomeKindMeta) string {
	switch x := m.(type) {
	case kindsys.RawMeta:
		return x.MachineName
	case kindsys.CoreStructuredMeta:
		return x.MachineName
	case kindsys.CustomStructuredMeta:
		return x.MachineName
	case kindsys.SlotImplMeta:
		return x.MachineName
	default:
		// unreachable so long as all the possibilities in KindMetas have switch branches
		panic("unreachable")
	}
}

func nameFor(m kindsys.SomeKindMeta) string {
	switch x := m.(type) {
	case kindsys.RawMeta:
		return x.Name
	case kindsys.CoreStructuredMeta:
		return x.Name
	case kindsys.CustomStructuredMeta:
		return x.Name
	case kindsys.SlotImplMeta:
		return x.Name
	default:
		// unreachable so long as all the possibilities in KindMetas have switch branches
		panic("unreachable")
	}
}

type genGoTypes struct {
	gokindsdir string
	cfg        *GoTypesGeneratorConfig
}

var _ KindGenStep = &genGoTypes{}

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

type GoTypesGeneratorConfig struct {
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
// At minimum, a gokindsdir must be provided. This should be the path to the parent
// directory of the directory in which the types should be generated, relative
// to the project root. For example, if the types for a kind named "foo"
// should live at pkg/kind/foo/foo_gen.go, relpath should be "pkg/kind".
//
// This generator is a no-op for raw kinds.
func GoTypesGenerator(gokindsdir string, cfg *GoTypesGeneratorConfig) KindGenStep {
	if cfg == nil {
		cfg = new(GoTypesGeneratorConfig)
	}
	if cfg.GenDirName == nil {
		cfg.GenDirName = func(decl *DeclForGen) string {
			return machineNameFor(decl.Meta)
		}
	}

	return &genGoTypes{
		gokindsdir: gokindsdir,
		cfg:        cfg,
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
	// TODO allow using name instead of machine name in thema generator
	b, err := tgo.GenerateTypesOpenAPI(sch, &tgo.TypeConfigOpenAPI{
		PackageName: filepath.Base(pdir),
		Apply:       gen.cfg.Apply,
	})
	if err != nil {
		return nil, err
	}
	return &GeneratedFile{
		RelativePath: filepath.Join(gen.gokindsdir, pdir, lin.Name()+"_types_gen.go"),
		Data:         b,
	}, nil
}

type genCoreStructuredKind struct {
	gokindsdir string
	cfg        *CoreStructuredKindGeneratorConfig
}

var _ KindGenStep = &genCoreStructuredKind{}

type CoreStructuredKindGeneratorConfig struct {
	// GenDirName returns the name of the directory in which the file should be
	// generated. Defaults to DeclForGen.Lineage().Name() if nil.
	GenDirName func(*DeclForGen) string
}

// CoreStructuredKindGenerator generates the implementation of
// [kindsys.Structured] for the provided kind declaration.
//
// gokindsdir should be the relative path to the parent directory that contains
// all generated kinds.
//
// This generator only has output for core structured kinds.
func CoreStructuredKindGenerator(gokindsdir string, cfg *CoreStructuredKindGeneratorConfig) KindGenStep {
	if cfg == nil {
		cfg = new(CoreStructuredKindGeneratorConfig)
	}
	if cfg.GenDirName == nil {
		cfg.GenDirName = func(decl *DeclForGen) string {
			return machineNameFor(decl.Meta)
		}
	}

	return &genCoreStructuredKind{
		gokindsdir: gokindsdir,
		cfg:        cfg,
	}
}

func (gen *genCoreStructuredKind) Name() string {
	return "CoreStructuredKindGenerator"
}

func (gen *genCoreStructuredKind) Generate(decl *DeclForGen) (*GeneratedFile, error) {
	if !decl.IsCoreStructured() {
		return nil, nil
	}

	path := filepath.Join(gen.gokindsdir, gen.cfg.GenDirName(decl), machineNameFor(decl.Meta)+"_kind_gen.go")
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

	return &GeneratedFile{
		RelativePath: path,
		Data:         b,
	}, nil
}

type genBaseRegistry struct {
	path        string
	kindrelroot string
}

var _ AggregateKindGenStep = &genBaseRegistry{}

// BaseCoreRegistryGenerator generates a static registry for core kinds that
// is only initializes their [kindsys.Interface]. No slot kinds are composed.
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
