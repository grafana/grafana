package pfs

import (
	"cuelang.org/go/cue/ast"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
)

type PluginDecl struct {
	SchemaInterface *SchemaInterface
	Lineage         thema.Lineage
	Imports         []*ast.ImportSpec
	PluginPath      string
	PluginMeta      Metadata
	KindDecl        kindsys.Def[kindsys.ComposableProperties]
}

type SchemaInterface struct {
	Name    string
	IsGroup bool
}

type Metadata struct {
	Id      string
	Name    string
	Backend *bool
	Version *string
}

func EmptyPluginDecl(path string, meta Metadata) *PluginDecl {
	return &PluginDecl{
		PluginPath: path,
		PluginMeta: meta,
		Imports:    make([]*ast.ImportSpec, 0),
	}
}

func (decl *PluginDecl) HasSchema() bool {
	return decl.Lineage != nil && decl.SchemaInterface != nil
}
