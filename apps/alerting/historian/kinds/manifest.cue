package kinds

import (
	"github.com/grafana/grafana/apps/alerting/historian/kinds/v0alpha1"
)

manifest: {
	appName:       "alerting-historian"
	groupOverride: "historian.alerting.grafana.app"
	versions: {
		"v0alpha1": {
			kinds: [dummyv0alpha1]
			routes: v0alpha1.routes
		}
	}
	roles: {}
}

dummyv0alpha1: {
    kind: "Dummy"
    schema: {
        // Spec is the schema of our resource. The spec should include all the user-editable information for the kind.
        spec: {
            dummyField: int
        }
    }
}
