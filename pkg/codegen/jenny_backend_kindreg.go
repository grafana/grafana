package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
)

// BackendKindRegistryJenny generates a static registry of core kinds layered on
// top of the publicly consumable generated registry in pkg/corekinds, but with
// additional capabilities necessary for and only executable within the Grafana
// backend.
//
// Path should be the relative path to the directory that will contain the
// generated registry. kindrelroot should be the repo-root-relative path to the
// parent directory to all directories that contain generated kind bindings
// (e.g. pkg/kind).
func BackendKindRegistryJenny(path, kindrelroot string) ManyToOne {
	return &backendregjenny{
		path:        path,
		kindrelroot: kindrelroot,
	}
}

type backendregjenny struct {
	path        string
	kindrelroot string
}

func (j *backendregjenny) JennyName() string {
	return "BackendKindRegistryJenny"
}

func (j *backendregjenny) Generate(decls ...*DeclForGen) (*codejen.File, error) {
	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("kind_registry_backend.tmpl").Execute(buf, tvars_kind_registry_backend{
		BackendKindPackagePrefix: filepath.ToSlash(filepath.Join("github.com/grafana/grafana", j.kindrelroot)),
		Kinds:                    decls,
	}); err != nil {
		return nil, fmt.Errorf("failed executing backend kind registry template: %w", err)
	}

	b, err := postprocessGoFile(genGoFile{
		path: j.path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(filepath.Join(j.path, "registry_gen.go"), b, j), nil
}
