package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules-extensions/kinds/v0alpha1"
)

prometheusRuleFileKind: {
	kind:       "PrometheusRuleFile"
	pluralName: "PrometheusRuleFiles"
}

prometheusRuleFilev0alpha1: prometheusRuleFileKind & {
	schema: {
		spec: v0alpha1.PrometheusRuleFileSpec
		// status tracks the child resources currently owned by this PrometheusRuleFile.
		// It is the source of truth used by the reconciler to prune children that no longer
		// appear in the spec — AlertRules and RecordingRules live in legacy storage which does
		// not preserve arbitrary labels, so name-based bookkeeping in status is the only
		// reliable way to find what we previously created.
		status: {
			managedFolders?: [...string]
			managedAlertRules?: [...string]
			managedRecordingRules?: [...string]
		}
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
	selectableFields: []
}
