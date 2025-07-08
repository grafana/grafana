package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

rolev0alpha1: {
	kind:   "Role"
	plural: "roles"
	scope:  "Namespaced"
	schema: {
		spec: v0alpha1.RoleSpec
	}
}
