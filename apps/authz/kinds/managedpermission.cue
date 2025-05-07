package kinds

import (
	"github.com/grafana/grafana/apps/authz/kinds/v0alpha1"
)

managedpermission: {
	kind:       "ManagedPermission"
	pluralName: "ManagedPermissions"
	current:    "v0alpha1"

	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec:   v0alpha1.ManagedPermission
			}
		}
	}
}
