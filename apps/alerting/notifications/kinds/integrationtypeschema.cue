package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

integrationTypeSchemaKind: {
	kind:       "IntegrationTypeSchema"
	pluralName: "IntegrationTypeSchemas"
}

integrationTypeSchemav0alpha1: integrationTypeSchemaKind & {
	schema: {
		spec: v0alpha1.IntegrationTypeSchemaSpec
	}
}
