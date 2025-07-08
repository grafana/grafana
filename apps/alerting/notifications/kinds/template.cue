package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

templateGroupv0alpha1: {
	kind:   "TemplateGroup"
	plural: "templategroups"
	scope:  "Namespaced"
	schema: {
		spec: v0alpha1.TemplateGroupSpec
	}
	selectableFields: [
		"spec.title",
	]
}
