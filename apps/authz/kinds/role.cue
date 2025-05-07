package kinds

import (
	"github.com/grafana/grafana/apps/authz/kinds/v0alpha1"
)

role: {
	kind:       "Role"
	pluralName: "Roles"
	current:    "v0alpha1"

	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
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

	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec:   v0alpha1.RoleSpec
			}
		}
	}
}

clusterrole: {
	kind:       "ClusterRole"
	pluralName: "ClusterRoles"
	current:    "v0alpha1"

	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec:   v0alpha1.RoleSpec
			}
		}
	}
}