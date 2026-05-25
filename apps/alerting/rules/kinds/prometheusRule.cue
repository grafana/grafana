package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

prometheusRuleKind: {
	kind:       "PrometheusRule"
	pluralName: "PrometheusRules"
}

prometheusRulev0alpha1: prometheusRuleKind & {
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
}
