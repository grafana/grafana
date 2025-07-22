package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

user: {
	kind:       "User"
	pluralName: "Users"
	current:    "v0alpha1"
    
	versions: {
		"v0alpha1": {
			codegen: {
				ts: { enabled: false }
				go: { enabled: true }
			}
			validation: {
				operations: [
					"CREATE",
					"UPDATE",
				]
			}
			schema: {
				spec: v0alpha1.UserSpec
			}
		}
	}
}
