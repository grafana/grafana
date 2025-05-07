package kinds

import (
	"github.com/grafana/grafana/apps/authz/kinds/v0alpha1"
)

resourcepermission: {
	kind:       "ResourcePermission"
	pluralName: "ResourcePermissions"
	current:    "v0alpha1"

	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec:   v0alpha1.ResourcePermission
			}
		}
	}
}
