package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

recordingRuleKind: {
	kind:       "RecordingRule"
	pluralName: "RecordingRules"
}

recordingRulev0alpha1: recordingRuleKind & {
	schema: {
		spec:   v0alpha1.#RecordingRuleSpec
		status: v0alpha1.#RecordingRuleStatus
	}
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
			"DELETE",
		]
	}
	mutation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	selectableFields: [
		"spec.title",
		"spec.paused",
		"spec.metric",
		"spec.targetDatasourceUID",
		// TODO: add status fields for filtering
	]

	// searchFields drive the unified-storage search index for recording rules.
	// See alertRule.cue for the path vs computed-field split; recording rules
	// have metric and targetDatasourceUID instead of the alerting-only fields
	// and share the computed type / labels / datasourceUIDs handling.
	searchFields: [
		{
			name: "type"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The rule type discriminator (always \"recordingrule\")"
		},
		{
			name: "interval"
			path: "spec.trigger.interval"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The evaluation interval of the rule"
		},
		{
			name: "paused"
			path: "spec.paused"
			type: "boolean"
			capabilities: ["filter", "retrieve"]
			description: "Whether the rule is paused"
		},
		{
			name:  "labels"
			type:  "string"
			array: true
			capabilities: ["filter", "retrieve"]
			description: "The rule's labels, flattened to key and key=value terms"
		},
		{
			name:  "datasourceUIDs"
			type:  "string"
			array: true
			capabilities: ["filter", "retrieve"]
			description: "The query datasource UIDs referenced by the rule's expressions"
		},
		{
			name: "metric"
			path: "spec.metric"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The name of the recorded metric"
		},
		{
			name: "targetDatasourceUID"
			path: "spec.targetDatasourceUID"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The UID of the datasource the metric is written to"
		},
	]
}
