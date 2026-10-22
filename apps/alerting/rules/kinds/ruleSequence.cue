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

	// searchFields drive the unified-storage search index for rule sequences,
	// so clients can find the sequence containing a rule by searching for its
	// UID. Recording and alerting members are separate fields because the
	// standard path extractor reads one path per field.
	searchFields: [
		{
			name:  "recordingRuleUIDs"
			path:  "spec.recordingRules[*].name"
			type:  "string"
			array: true
			capabilities: ["filter", "retrieve"]
			description: "UIDs of the recording rules in the sequence"
		},
		{
			name:  "alertingRuleUIDs"
			path:  "spec.alertingRules[*].name"
			type:  "string"
			array: true
			capabilities: ["filter", "retrieve"]
			description: "UIDs of the alert rules in the sequence"
		},
		{
			name: "interval"
			path: "spec.trigger.interval"
			type: "string"
			capabilities: ["retrieve"]
			description: "The evaluation interval of the sequence"
		},
	]
}
