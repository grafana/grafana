package secret

import "github.com/grafana/grafana/apps/secret/kinds/v1beta1"

keeper: {
	kind:       "Keeper"
	pluralName: "Keepers"
	current:    "v1beta1"
	scope:      "Namespaced"
	codegen: {
		ts: {
			enabled: false
		}
		go: {
			enabled: true
		}
	}
	versions: {
		"v1beta1": {
			schema: {
				spec: v1beta1.KeeperSpec
			}
		}
	}
}
