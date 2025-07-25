package secret

import "github.com/grafana/grafana/apps/secret/kinds/v1beta1"

securevalue: {
	kind:       "SecureValue"
	pluralName: "SecureValues"
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
				spec:   v1beta1.SecureValueSpec
				status: v1beta1.SecureValueStatus
			}
		}
	}
}
