package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

ruleSequenceKind: {
	kind:       "RuleSequence"
	pluralName: "RuleSequences"
}

ruleSequencev0alpha1: ruleSequenceKind & {
	schema: {
		spec: v0alpha1.RuleSequenceSpec
	}
	// DELETE is intentionally omitted from validation operations.
	// Unlike AlertRule/RecordingRule (which need DELETE validation to enforce
	// sequence-membership guardrails), RuleSequences themselves have no delete
	// constraints: deleting a sequence simply removes the grouping.
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
