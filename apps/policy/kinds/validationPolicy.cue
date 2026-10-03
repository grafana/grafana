package kinds

import (
	"github.com/grafana/grafana/apps/policy/kinds/v0alpha1"
)

validationPolicyKind: {
	kind:       "ValidationPolicy"
	pluralName: "ValidationPolicies"
}

validationPolicyv0alpha1: validationPolicyKind & {
	schema: {
		spec:   v0alpha1.#ValidationPolicySpec
		status: v0alpha1.#ValidationPolicyStatus
	}
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
}
