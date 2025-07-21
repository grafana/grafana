package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

resourcepermission: {
	kind:       "ResourcePermission"
	pluralName: "ResourcePermissions"
	current:    "v0alpha1"

	versions: {
		"v0alpha1": {
			codegen: {
				ts: { enabled: false }
				go: { enabled: true }
			}
			schema: {
				spec:   v0alpha1.ResourcePermission
			}
		}
	}
}
