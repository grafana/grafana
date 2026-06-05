package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

adminConfigKind: {
	kind:       "AdminConfig"
	pluralName: "AdminConfigs"
}

adminConfigv0alpha1: adminConfigKind & {
	schema: {
		spec:   v0alpha1.AdminConfigSpec
		status: v0alpha1.AdminConfigStatus
	}
	// Required so the SDK accepts the admission Validator attached on the
	// kind via simple.AppManagedKind in pkg/app/app.go. The validator
	// itself is wired from the parent process via the app Config.
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
}
