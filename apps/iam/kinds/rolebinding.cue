package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
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

globalrolebinding: {
	kind:       "GlobalRoleBinding"
	pluralName: "GlobalRoleBindings"
	current:    "v0alpha1"

	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec:   v0alpha1.GlobalRoleBindingSpec
			}
		}
	}
}
