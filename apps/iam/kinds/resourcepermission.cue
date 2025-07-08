package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

resourcepermissionv0alpha1: {
	kind:   "ResourcePermission"
	plural: "resourcepermissions"
	scope:  "Namespaced"
	schema: {
		spec: v0alpha1.ResourcePermission
	}
}
