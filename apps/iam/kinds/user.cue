package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

user: {
	kind:       "User"
	pluralName: "Users"
	current:    "v0alpha1"
    
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec: v0alpha1.UserSpec
			}
		}
	}
}