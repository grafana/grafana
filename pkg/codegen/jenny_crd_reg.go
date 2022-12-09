package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
)

// CRDKindRegistryJenny generates a static registry of the CRD representations
// of core Grafana kinds, layered on top of the publicly consumable generated
// registry in pkg/corekinds.
//
// Path should be the relative path to the directory that will contain the
// generated registry.
func CRDKindRegistryJenny(path string) ManyToOne {
	return &crdregjenny{
		path: path,
	}
}

type crdregjenny struct {
	path string
}

func (j *crdregjenny) JennyName() string {
	return "CRDKindRegistryJenny"
}

func (j *crdregjenny) Generate(decls ...*DeclForGen) (*codejen.File, error) {
	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("core_crd_registry.tmpl").Execute(buf, tvars_kind_registry{
		PackageName:       "corecrd",
		KindPackagePrefix: filepath.ToSlash(filepath.Join("github.com/grafana/grafana", kindsys.GoCoreKindParentPath)),
		Kinds:             decls,
	}); err != nil {
		return nil, fmt.Errorf("failed executing core crd registry template: %w", err)
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
