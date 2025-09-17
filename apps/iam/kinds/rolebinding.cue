package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

rolebindingKind: {
	kind:       "RoleBinding"
	pluralName: "RoleBindings"
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}
}

globalrolebindingKind: {
	kind:       "GlobalRoleBinding"
	pluralName: "GlobalRoleBindings"
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}
}

rolebindingv0alpha1: rolebindingKind & {
	schema: {
		spec:   v0alpha1.RoleBindingSpec
	}
}

globalrolebindingv0alpha1: globalrolebindingKind & {
	schema: {
		spec:   v0alpha1.GlobalRoleBindingSpec
	}
}
