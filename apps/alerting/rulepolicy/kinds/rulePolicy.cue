package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rulepolicy/kinds/v0alpha1"
)

rulePolicyKind: {
	kind:       "RulePolicy"
	pluralName: "RulePolicies"
}

rulePolicyv0alpha1: rulePolicyKind & {
	schema: {
		spec:   v0alpha1.#RulePolicySpec
		status: v0alpha1.#RulePolicyStatus
	}
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
}
