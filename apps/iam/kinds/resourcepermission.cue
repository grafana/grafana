package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

resourcepermissionKind: {
	kind:       "ResourcePermission"
	pluralName: "ResourcePermissions"

	// Generic read routes bypass the access filtering used by resource permission lists.
	listKeys: false
	search: {
		endpoint: false
	}
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
}

resourcepermissionv0alpha1: resourcepermissionKind & {
	schema: {
		spec: v0alpha1.ResourcePermission
	}
}
