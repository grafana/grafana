package pfs

import (
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
)

type PluginDecl struct {
	SchemaInterface SchemaInterface
	CueFile         cue.Value
	Imports         []*ast.ImportSpec
	PluginPath      string
	PluginMeta      Metadata
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
