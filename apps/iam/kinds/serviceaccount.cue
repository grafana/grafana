package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

serviceaccount: {
	kind:       "ServiceAccount"
	pluralName: "ServiceAccounts"
	current:    "v0alpha1"

	versions: {
		"v0alpha1": {
			codegen: {
				ts: { enabled: false }
				go: { enabled: true }
			}
			schema: {
				spec: v0alpha1.ServiceAccountSpec
			}
		}
	}
}
