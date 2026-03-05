package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

inhibitionRuleKind: {
	kind:       "InhibitionRule"
	pluralName: "InhibitionRules"
}

inhibitionRulev0alpha1: inhibitionRuleKind & {
	schema: {
		spec: v0alpha1.InhibitionRuleSpec
	}
}
