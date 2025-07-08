package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

teamv0alpha1: {
	kind:   "Team"
	plural: "teams"
	scope:  "Namespaced"
	schema: {
		spec: v0alpha1.TeamSpec
	}
}
