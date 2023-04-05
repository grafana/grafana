package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"
)

// CRDWireSetJenny generates a WireSet for all CRDs.
func CRDWireSetJenny(path string) ManyToOne {
	return &crdWireSetJenny{
		path: path,
	}
}

type crdWireSetJenny struct {
	path string
}

func (j *crdWireSetJenny) JennyName() string {
	return "CRDWireSetJenny"
}

func (j *crdWireSetJenny) Generate(kinds ...kindsys.Kind) (*codejen.File, error) {
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
	if err := tmpls.Lookup("core_crd_wireset.tmpl").Execute(buf, tvars_kind_registry{
		PackageName:       "corecrd",
		KindPackagePrefix: filepath.ToSlash("github.com/grafana/grafana/pkg/services/k8s/resources"),
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

	return codejen.NewFile(filepath.Join(j.path, "wireset_gen.go"), b, j), nil
}
