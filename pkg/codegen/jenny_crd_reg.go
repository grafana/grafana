package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"

	"github.com/grafana/grafana/pkg/cuectx"
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

func (j *crdregjenny) Generate(kinds ...kindsys.Kind) (*codejen.File, error) {
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
	if err := tmpls.Lookup("core_crd_registry.tmpl").Execute(buf, tvars_kind_registry{
		PackageName:       "corecrd",
		KindPackagePrefix: filepath.ToSlash(filepath.Join("github.com/grafana/grafana", cuectx.GoCoreKindParentPath)),
		Kinds:             cores,
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
