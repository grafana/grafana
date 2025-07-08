package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

userv0alpha1: {
	kind:   "User"
	plural: "users"
	scope:  "Namespaced"
	schema: {
		spec: v0alpha1.UserSpec
	}
}
