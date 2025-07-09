package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

role: {
	kind:       "Role"
	pluralName: "Roles"
	current:    "v0alpha1"

	versions: {
		"v0alpha1": {
			codegen: {
				ts: { enabled: false }
				go: { enabled: true }
			}
			schema: {
				spec:   v0alpha1.RoleSpec
			}
		}
	}
}

corerole: {
	kind:       "CoreRole"
	pluralName: "CoreRoles"
	current:    "v0alpha1"

	versions: {
		"v0alpha1": {
			codegen: {
				ts: { enabled: false }
				go: { enabled: true }
			}
			schema: {
				spec:   v0alpha1.RoleSpec
			}
		}
	}
}

globalrole: {
	kind:       "GlobalRole"
	pluralName: "GlobalRoles"
	current:    "v0alpha1"

	versions: {
		"v0alpha1": {
			codegen: {
				ts: { enabled: false }
				go: { enabled: true }
			}
			schema: {
				spec:   v0alpha1.RoleSpec
			}
		}
	}
}