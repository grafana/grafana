package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

roleKind: {
	kind:       "Role"
	pluralName: "Roles"
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}
}

coreroleKind: {
	kind:       "CoreRole"
	pluralName: "CoreRoles"
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}
}

globalroleKind: {
	kind:       "GlobalRole"
	pluralName: "GlobalRoles"
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}
}

rolev0alpha1: roleKind & {
	schema: {
		spec:   v0alpha1.RoleSpec
	}
}

corerolev0alpha1: coreroleKind & {
	schema: {
		spec:   v0alpha1.RoleSpec
	}
}

globalrolev0alpha1: globalroleKind & {
	schema: {
		spec:   v0alpha1.RoleSpec
	}
}