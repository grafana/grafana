package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

recordingRule: {
	kind: "RecordingRule"
	apiResource: {
		groupOverride: "rules.alerting.grafana.app"
	}
	pluralName: "RecordingRules"
	current:    "v0alpha1"
	codegen: {
		ts: {enabled: true}
		go: {enabled: true}
	}
	versions: {
		"v0alpha1": {
			schema: {
				spec: v0alpha1.RecordingRuleSpec
			}
			selectableFields: [
				"spec.title",
			]
		}
	}
}
