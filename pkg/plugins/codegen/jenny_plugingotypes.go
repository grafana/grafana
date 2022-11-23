package codegen

import (
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/plugins/codegen/kindsys"
)

func PluginGoTypesJenny(inner codejen.OneToOne[*kindsys.PluginDecl]) codejen.OneToOne[*kindsys.PluginDecl] {
	return &pgoJenny{
		inner: inner,
	}
}

type pgoJenny struct {
	inner codejen.OneToOne[*kindsys.PluginDecl]
}

func (j *pgoJenny) JennyName() string {
	return "PluginGoTypesJenny"
}

func (j *pgoJenny) Generate(decl *kindsys.PluginDecl) (*codejen.File, error) {
	b := decl.PluginMeta.Backend
	if b == nil || !*b {
		return nil, nil
	}
	return j.inner.Generate(decl)
}
