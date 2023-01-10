package codegen

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

func PluginGoTypesJenny(root string, inner codejen.OneToOne[*pfs.PluginDecl]) codejen.OneToOne[*pfs.PluginDecl] {
	return &pgoJenny{
		inner: inner,
		root:  root,
	}
}

type pgoJenny struct {
	inner codejen.OneToOne[*pfs.PluginDecl]
	root  string
}

func (j *pgoJenny) JennyName() string {
	return "PluginGoTypesJenny"
}

func (j *pgoJenny) Generate(decl *pfs.PluginDecl) (*codejen.File, error) {
	b := decl.PluginMeta.Backend
	if b == nil || !*b || !decl.HasSchema() {
		return nil, nil
	}

	f, err := j.inner.Generate(decl)
	if err != nil {
		return nil, err
	}

	pluginfolder := filepath.Base(decl.PluginPath)
	slotname := strings.ToLower(decl.SchemaInterface.Name())
	filename := fmt.Sprintf("types_%s_gen.go", slotname)
	f.RelativePath = filepath.Join(j.root, pluginfolder, filename)
	f.From = append(f.From, j)

	return f, nil
}
