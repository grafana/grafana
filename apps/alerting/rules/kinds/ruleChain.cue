package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

ruleChainKind: {
	kind:       "RuleChain"
	pluralName: "RuleChains"
}

ruleChainv0alpha1: ruleChainKind & {
	schema: {
		spec: v0alpha1.RuleChainSpec
	}
	// DELETE is intentionally omitted from validation operations.
	// Unlike AlertRule/RecordingRule (which need DELETE validation to enforce
	// chain-membership guardrails), RuleChains themselves have no delete
	// constraints — deleting a chain simply removes the grouping.
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	mutation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	selectableFields: []
}
