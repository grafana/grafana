package kinds

import (
	"github.com/grafana/grafana/apps/policy/kinds/v0alpha1"
)

validationPolicyBindingKind: {
	kind:       "ValidationPolicyBinding"
	pluralName: "ValidationPolicyBindings"
}

validationPolicyBindingv0alpha1: validationPolicyBindingKind & {
	schema: {
		spec:   v0alpha1.#ValidationPolicyBindingSpec
		status: v0alpha1.#ValidationPolicyBindingStatus
	}
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	selectableFields: [
		"spec.policyName",
	]
}
