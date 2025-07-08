package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

rolebindingv0alpha1: {
	kind:   "RoleBinding"
	plural: "rolebindings"
	scope:  "Namespaced"
	schema: {
		spec: v0alpha1.RoleBindingSpec
	}
}

globalrolebindingv0alpha1: {
	kind:   "GlobalRoleBinding"
	plural: "globalrolebindings"
	scope:  "Cluster"
	schema: {
		spec: v0alpha1.GlobalRoleBindingSpec
	}
}
