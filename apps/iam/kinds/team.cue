package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

team: {
	kind:       "Team"
	pluralName: "Teams"
	current:    "v0alpha1"

	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec: v0alpha1.TeamSpec
			}
		}
	}
}