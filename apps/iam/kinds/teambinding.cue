package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

teambindingv0alpha1: {
	kind:   "TeamBinding"
	plural: "teambindings"
	scope:  "Namespaced"
	schema: {
		spec: v0alpha1.TeamBindingSpec
	}
}
