package pfs

import (
	"cuelang.org/go/cue/ast"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"

	"github.com/grafana/grafana/pkg/plugins/plugindef"
)

type PluginDecl struct {
	SchemaInterface *kindsys.SchemaInterface
	Lineage         thema.Lineage
	Imports         []*ast.ImportSpec
	PluginPath      string
	PluginMeta      plugindef.PluginDef
	KindDecl        kindsys.Def[kindsys.ComposableProperties]
}

func EmptyPluginDecl(path string, meta plugindef.PluginDef) *PluginDecl {
	return &PluginDecl{
		PluginPath: path,
		PluginMeta: meta,
		Imports:    make([]*ast.ImportSpec, 0),
	}
}

func (decl *PluginDecl) HasSchema() bool {
	return decl.Lineage != nil && decl.SchemaInterface != nil
}
