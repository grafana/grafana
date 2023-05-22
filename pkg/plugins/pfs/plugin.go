package pfs

import (
	"cuelang.org/go/cue/ast"
	"github.com/grafana/kindsys"

	"github.com/grafana/grafana/pkg/plugins/plugindef"
)

// ParsedPlugin represents everything knowable about a single plugin from static
// analysis of its filesystem tree contents, as performed by [ParsePluginFS].
//
// Guarantees described in the below comments only exist for instances of this
// struct returned from [ParsePluginFS].
type ParsedPlugin struct {
	// Properties contains the plugin's definition, as declared in plugin.json.
	Properties plugindef.PluginDef

	// ComposableKinds is a map of all the composable kinds declared in this plugin.
	// Keys are the name of the [kindsys.SchemaInterface] implemented by the value.
	//
	// Composable kind defs are only populated in this map by [ParsePluginFS] if
	// they are implementations of a known schema interface, or are for
	// an unknown schema interface.
	ComposableKinds map[string]kindsys.Composable

	// CustomKinds is a map of all the custom kinds declared in this plugin.
	// Keys are the machineName of the custom kind.
	// CustomKinds map[string]kindsys.Custom

	// CUEImports lists the CUE import statements in the plugin's grafanaplugin CUE
	// package, if any.
	CUEImports []*ast.ImportSpec
}

// TODO is this static approach worth using, akin to core generated registries? instead of the ParsedPlugins.ComposableKinds map? in addition to it?
// ComposableKinds represents all the possible composable kinds that may be
// defined in a Grafana plugin.
//
// The value of each field, if non-nil, is a standard [kindsys.Def]
// representing a CUE definition of a composable kind that implements the
// schema interface corresponding to the field's name. (This invariant is
// only enforced in [ComposableKinds] returned from [ParsePluginFS].)
//
// type ComposableKinds struct {
// 	PanelCfg kindsys.Def[kindsys.ComposableProperties]
// 	Queries  kindsys.Def[kindsys.ComposableProperties]
// 	DSCfg    kindsys.Def[kindsys.ComposableProperties]
// }
