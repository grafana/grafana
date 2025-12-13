package kinds

import (
	"github.com/grafana/grafana/apps/alerting/historian/kinds/v0alpha1"
)

manifest: {
	appName:       "alerting-historian"
	groupOverride: "historian.alerting.grafana.app"
	versions: {
		"v0alpha1": {
			routes: v0alpha1.routes
		}
	}
}
