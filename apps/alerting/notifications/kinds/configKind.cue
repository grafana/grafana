package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

configKind: {
	kind:       "Config"
	pluralName: "Configs"
}

configv0alpha1: configKind & {
	schema: {
		spec:   v0alpha1.ConfigSpec
		status: v0alpha1.ConfigStatus
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
