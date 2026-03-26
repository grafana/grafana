package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v1beta1"
)

templateKind: {
	kind:       "TemplateGroup"
	pluralName: "TemplateGroups"
}

templatev0alpha1: templateKind & {
	schema: {
		spec: v0alpha1.TemplateGroupSpec
	}
	//	selectableFields: [ // TODO revisit when custom field selectors are supported
	//		"spec.title",
	//	]
}

templatev1beta1: templateKind & {
	schema: {
		spec: v1beta1.TemplateGroupSpec
	}
	//	selectableFields: [ // TODO revisit when custom field selectors are supported
	//		"spec.title",
	//	]
}
