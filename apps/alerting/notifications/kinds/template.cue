package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

templateKind: {
	kind: "TemplateGroup"
	pluralName: "TemplateGroups"
}

templatev0alpha1: templateKind & {
	schema: {
		spec: v0alpha1.TemplateGroupSpec
	}
	selectableFields: [
		"spec.title",
	]
}