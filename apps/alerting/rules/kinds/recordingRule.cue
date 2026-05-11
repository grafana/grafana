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
		spec: v0alpha1.RecordingRuleSpec
	}
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
	selectableFields: [
		"spec.title",
		"spec.paused",
		"spec.metric",
		"spec.targetDatasourceUID",
		// TODO: add status fields for filtering
	]
}
