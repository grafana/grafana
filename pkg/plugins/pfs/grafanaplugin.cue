package pfs

import "github.com/grafana/grafana/pkg/kindsys"

// GrafanaPlugin specifies what plugins may declare in .cue files in a
// `grafanaplugin` CUE package in the plugin root directory (adjacent to plugin.json).
GrafanaPlugin: {
	id: string

	// A plugin defines its #Composable kinds under this key.
	//
	// This struct is open for forwards compatibility - older versions of Grafana (or
	// dependent tooling) should not break if new versions introduce additional schema interfaces.
	composableKinds?: [Iface=string]: kindsys.Composable & {
		name: Iface
		schemaInterface: Iface
		lineage: name: id
	}

	// A plugin defines its #CustomStructured kinds under this key.
	customKinds?: [Name=string]: kindsys.CustomStructured & {
		name: Name
	}
	...
}
