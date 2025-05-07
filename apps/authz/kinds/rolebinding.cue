package kinds

import (
	"github.com/grafana/grafana/apps/authz/kinds/v0alpha1"
)

rolebinding: {
	kind:       "RoleBinding"
	pluralName: "RoleBindings"
	current:    "v0alpha1"

	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec:   v0alpha1.RoleBindingSpec
			}
		}
	}
}

clusterrolebinding: {
	kind:       "ClusterRoleBinding"
	pluralName: "ClusterRoleBindings"
	current:    "v0alpha1"

	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec:   v0alpha1.RoleBindingSpec
			}
		}
	}
}
