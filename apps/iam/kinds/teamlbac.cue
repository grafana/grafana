package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

teamlbacruleKind: {
	kind:       "TeamLBACRule"
	pluralName: "TeamLBACRules"
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
}

teamlbacrulev0alpha1: teamlbacruleKind & {
	schema: {
		spec: v0alpha1.TeamLBACRuleSpec
	}
	routes: {
		"/for-subject/{type}/{uid}": {
			"GET": {
				// App SDK client generation does not yet interpolate path parameters.
				// A hand-written client method exposes this route with typed arguments.
				name: "getTeamLBACRulesForSubjectRoute"
				response: {
					team_filters: [string]: [...string]
				}
				responseMetadata: objectMeta: false
			}
		}
	}
}
