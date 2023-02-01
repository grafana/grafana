package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
)

// CRDTypesJenny generates the OpenAPI CRD representation for a core
// structured kind that is expected by Kubernetes controller machinery.
func CRDTypesJenny(path string) OneToOne {
	return crdTypesJenny{
		parentpath: path,
	}
}

type crdTypesJenny struct {
	parentpath string
}

func (j crdTypesJenny) JennyName() string {
	return "CRDTypesJenny"
}

func (j crdTypesJenny) Generate(kind kindsys.Kind) (*codejen.File, error) {
	_, isCore := kind.(kindsys.Core)
	_, isCustom := kind.(kindsys.Core)
	if !(isCore || isCustom) {
		return nil, nil
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("core_crd_types.tmpl").Execute(buf, kind); err != nil {
		return nil, fmt.Errorf("failed executing crd types template: %w", err)
	}

	name := kind.Props().Common().MachineName
	path := filepath.Join(j.parentpath, name, "crd", name+"_crd_gen.go")
	b, err := postprocessGoFile(genGoFile{
		path: path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(path, b, j), nil
}
