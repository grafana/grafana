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
