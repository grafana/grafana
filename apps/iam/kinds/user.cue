package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

userKind: {
	kind:       "User"
	pluralName: "Users"
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
}

userv0alpha1: userKind & {
	schema: {
		spec: v0alpha1.UserSpec
	}
}
