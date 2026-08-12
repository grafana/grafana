package kinds

import "github.com/grafana/grafana/apps/network/kinds/v1alpha1"

manifest: {
	appName:       "network"
	groupOverride: "network.grafana.app"
	versions: {
		"v1alpha1": v1alpha1.manifest
	}
	roles: {}
}
