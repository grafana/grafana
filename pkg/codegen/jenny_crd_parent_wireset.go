package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
)

// CRDResourcesWireSetJenny generates a WireSet for all CRDs.
func CRDResourcesWireSetJenny(path string) ManyToOne {
	return &crdResourcesWireSetJenny{
		path: path,
	}
}

type crdResourcesWireSetJenny struct {
	path string
}

func (j *crdResourcesWireSetJenny) JennyName() string {
	return "CRDParentWireSetJenny"
}

func (j *crdResourcesWireSetJenny) Generate(kinds ...kindsys.Kind) (*codejen.File, error) {
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
	if err := tmpls.Lookup("core_crd_resources_wireset.tmpl").Execute(buf, tvars_kind_registry{
		PackageName:       "corecrd",
		KindPackagePrefix: filepath.ToSlash("github.com/grafana/grafana/pkg/services/k8s/resources"),
		Kinds:             cores,
	}); err != nil {
		return nil, fmt.Errorf("failed executing CRD resources wireset template: %w", err)
	}

	b, err := postprocessGoFile(genGoFile{
		path: j.path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(filepath.Join(j.path, "wire_gen.go"), b, j), nil
}
