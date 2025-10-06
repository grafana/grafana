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
	selectableFields: [
		"spec.title",
		"spec.paused",
		// FIXME(@moustafab): not sure why these fields are being considered structs... Bug in codegen
		// "spec.metric",
		// "spec.targetDatasourceUID",
		// TODO: add status fields for filtering
	]
}
