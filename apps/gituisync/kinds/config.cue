package core

externalName: {
	kind: "NoOp"
	pluralName: "NoOps"
	group: "gituisync"
	apiResource: {
		groupOverride: "gituisync.grafana.app"
		mutation: operations: ["create","update"]
		validation: operations: ["create","update"]
	}
	codegen: {
		frontend: false
		backend: true
	}

	current: "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				spec: {
					noop_value_here: bool
				}
			}
		}
	}
}