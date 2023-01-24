package codegen

import (
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

func PluginDocsJenny(inner codejen.OneToOne[*pfs.PluginDecl]) codejen.OneToOne[*pfs.PluginDecl] {
	return &docsJenny{
		inner: inner,
	}
}

type docsJenny struct {
	inner codejen.OneToOne[*pfs.PluginDecl]
}

func (j *docsJenny) JennyName() string {
	return "PluginDocsJenny"
}

func (j *docsJenny) Generate(decl *pfs.PluginDecl) (*codejen.File, error) {
	if !decl.HasSchema() {
		return nil, nil
	}

	return j.inner.Generate(decl)
}
