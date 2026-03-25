package kinds

import "github.com/grafana/grafana/apps/secret/kinds/v1"

manifest: {
	appName:       "secret"
	groupOverride: "secret.grafana.app"
	versions: {
		"v1": v1.manifest
	}
	roles: {}
}
