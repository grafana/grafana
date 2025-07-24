package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

resourcepermissionKind: {
	kind:       "ResourcePermission"
	pluralName: "ResourcePermissions"
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}
}

resourcepermissionv0alpha1: resourcepermissionKind & {
	schema: {
		spec:   v0alpha1.ResourcePermission
	}
}
