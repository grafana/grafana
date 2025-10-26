package kinds

import "github.com/grafana/grafana/apps/secret/kinds/v1beta1"

manifest: {
	appName:       "secret"
	groupOverride: "secret.grafana.app"
	versions: {
		"v1beta1": v1beta1.manifest
	}
}
