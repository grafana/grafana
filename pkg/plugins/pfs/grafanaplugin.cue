package pfs

import (
	"github.com/grafana/grafana/pkg/kindsys"
)

// GrafanaPlugin specifies what plugins may declare in .cue files in a
// `grafanaplugin` CUE package in the plugin root directory (adjacent to plugin.json).
GrafanaPlugin: {
	// id and pascalName are injected from plugin.json. Plugin authors can write
	// values for them in .cue files, but the only valid values will be the ones
	// given in plugin.json.
	id: string
	pascalName: string

	// A plugin defines its Composable kinds under this key.
	//
	// This struct is open for forwards compatibility - older versions of Grafana (or
	// dependent tooling) should not break if new versions introduce additional schema interfaces.
	composableKinds?: [Iface=string]: kindsys.Composable & {
		name: pascalName + Iface
		schemaInterface: Iface
		lineage: name: pascalName + Iface
	}

	// A plugin defines its Custom kinds under this key.
	customKinds?: [Name=string]: kindsys.Custom & {
		name: Name
	}
	...
}
