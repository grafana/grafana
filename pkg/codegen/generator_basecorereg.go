package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/sdboyer/jennywrites"
)

// BaseCoreRegistryGenerator generates a static registry for core kinds that
// is only initializes their [kindsys.Interface]. No slot kinds are composed.
//
// Path should be the relative path to the directory that will contain the
// generated registry. kindrelroot should be the repo-root-relative path to the
// parent directory to all directories that contain generated kind bindings
// (e.g. pkg/kind).
func BaseCoreRegistryGenerator(path, kindrelroot string) ManyToOne {
	return &genBaseRegistry{
		path:        path,
		kindrelroot: kindrelroot,
	}
}

type genBaseRegistry struct {
	path        string
	kindrelroot string
}

var _ ManyToOne = &genBaseRegistry{}

func (gen *genBaseRegistry) JennyName() string {
	return "BaseCoreRegistryGenerator"
}

func (gen *genBaseRegistry) Generate(decls []*DeclForGen) (*jennywrites.File, error) {
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

	return jennywrites.NewFile(filepath.Join(gen.path, "base_gen.go"), b, gen), nil
}
