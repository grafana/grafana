package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

teambinding: {
	kind:       "TeamBinding"
	pluralName: "TeamBindings"
	current:    "v0alpha1"

	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec: v0alpha1.TeamBindingSpec
			}
		}
	}
}
