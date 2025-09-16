package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

serviceaccountKind: {
	kind:       "ServiceAccount"
	pluralName: "ServiceAccounts"
	codegen: {
		ts: { enabled: false }
		go: { enabled: true }
	}
}

serviceaccountv0alpha1: serviceaccountKind & {
	schema: {
		spec: v0alpha1.ServiceAccountSpec
	}
}