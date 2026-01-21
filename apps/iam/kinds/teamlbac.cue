package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

teamlbacruleKind: {
	kind:       "TeamLBACRule"
	pluralName: "TeamLBACRules"
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}
}

teamlbacrulev0alpha1: teamlbacruleKind & {
	schema: {
		spec:   v0alpha1.TeamLBACRuleSpec
	}
}
