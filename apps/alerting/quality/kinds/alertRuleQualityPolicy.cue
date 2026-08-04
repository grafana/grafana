package kinds

import (
	"github.com/grafana/grafana/apps/alerting/quality/kinds/v0alpha1"
)

alertRuleQualityPolicyKind: {
	kind:       "AlertRuleQualityPolicy"
	pluralName: "AlertRuleQualityPolicies"
	// The policy applies to a whole org, and the namespace is the org, so the
	// resource is namespaced but never folder-scoped.
	scope:        "Namespaced"
	folderScoped: false
}

alertRuleQualityPolicyv0alpha1: alertRuleQualityPolicyKind & {
	schema: {
		spec: v0alpha1.AlertRuleQualityPolicySpec
	}
	// No validation or mutation operations: the singleton-name check lives in
	// the consumer that registers this kind, not in this module.
	selectableFields: []
}
