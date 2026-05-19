package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules-extensions/kinds/v0alpha1"
)

prometheusRuleGroupKind: {
	kind:       "PrometheusRuleGroup"
	pluralName: "PrometheusRuleGroups"
}

prometheusRuleGroupv0alpha1: prometheusRuleGroupKind & {
	schema: {
		spec: v0alpha1.PrometheusRuleSpec
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
