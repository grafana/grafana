package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

prometheusRuleGroupKind: {
	kind:       "PrometheusRuleGroup"
	pluralName: "PrometheusRuleGroups"
}

prometheusRuleGroupv0alpha1: prometheusRuleGroupKind & {
	schema: {
		spec: v0alpha1.PrometheusRuleGroupSpec
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
		"spec.name",
	]
}
