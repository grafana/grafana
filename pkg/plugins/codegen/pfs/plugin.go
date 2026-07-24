package pfs

import (
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
)

// ParsedPlugin represents everything knowable about a single plugin from static
// analysis of its filesystem tree contents, as performed by [ParsePluginFS].
//
// Guarantees described in the below comments only exist for instances of this
// struct returned from [ParsePluginFS].
type ParsedPlugin struct {
	// Properties contains the plugin's definition, as declared in plugin.json.
	Properties Metadata
	CueFile    cue.Value
	Variant    SchemaInterface

	// CUEImports lists the CUE import statements in the plugin's grafanaplugin CUE
	// package, if any.
	CUEImports []*ast.ImportSpec
}
