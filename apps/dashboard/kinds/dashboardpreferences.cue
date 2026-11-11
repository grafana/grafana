package kinds

import (
	v2beta1 "github.com/grafana/grafana/sdkkinds/dashboard/v2beta1"
)

dashboardPreferencesV2beta1: {
	kind: "DashboardPreferences"
	// The kind already ends in "s"; the SDK default (kind + "s") would serve "dashboardpreferencess".
	pluralName: "DashboardPreferences"
	// API contract:
	// - one object per tier; metadata.name identifies the tier:
	//   org "namespace", folder "folder-<folderUID>", user "user-<userUID>"
	// - a folder tier object also carries metadata.annotations["grafana.app/folder"], which must match its name
	// - an absent spec field means "inherit from the next tier"; a field listed in spec.reset means "use
	//   Grafana's built-in default"
	// List returns only the caller's own objects. The generic list-keys, search and trash routes
	// cannot apply that filtering, so the kind serves none of them.
	listKeys: false
	search: {
		endpoint: false
		trash:    false
	}
	validation: {
		operations: ["CREATE", "UPDATE"]
	}
	mutation: {
		operations: ["CREATE", "UPDATE"]
	}
	schema: {
		spec: v2beta1.DashboardPreferencesSpec
	}
}
