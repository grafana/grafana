package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"
)

// BaseCoreRegistryJenny generates a static registry for core kinds that
// only initializes their [kindsys.Kind]. No slot kinds are composed.
//
// Path should be the relative path to the directory that will contain the
// generated registry. kindrelroot should be the repo-root-relative path to the
// parent directory to all directories that contain generated kind bindings
// (e.g. pkg/kind).
func BaseCoreRegistryJenny(path, kindrelroot string) ManyToOne {
	return &genBaseRegistry{
		path:        path,
		kindrelroot: kindrelroot,
	}
}

type genBaseRegistry struct {
	path        string
	kindrelroot string
}

func (gen *genBaseRegistry) JennyName() string {
	return "BaseCoreRegistryJenny"
}

func (gen *genBaseRegistry) Generate(kinds ...kindsys.Kind) (*codejen.File, error) {
	cores := make([]kindsys.Core, 0, len(kinds))
	for _, d := range kinds {
		if corekind, is := d.(kindsys.Core); is {
			cores = append(cores, corekind)
		}
	}
	if len(cores) == 0 {
		return nil, nil
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("kind_registry.tmpl").Execute(buf, tvars_kind_registry{
		PackageName:       filepath.Base(gen.path),
		KindPackagePrefix: filepath.ToSlash(filepath.Join("github.com/grafana/grafana", gen.kindrelroot)),
		Kinds:             cores,
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

	return codejen.NewFile(filepath.Join(gen.path, "base_gen.go"), b, gen), nil
}
