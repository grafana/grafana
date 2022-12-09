package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
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

func (j crdTypesJenny) Generate(decl *DeclForGen) (*codejen.File, error) {
	if !(decl.IsCoreStructured() || decl.IsCustomStructured()) {
		return nil, nil
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("core_crd_types.tmpl").Execute(buf, decl); err != nil {
		return nil, fmt.Errorf("failed executing crd types template: %w", err)
	}

	name := decl.Properties.Common().MachineName
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
