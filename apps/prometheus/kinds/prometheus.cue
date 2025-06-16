package kinds

prometheus: {
	kind: "Prometheus"
	pluralName: "Prometheuses"
	current: "v0alpha1"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: true
				backend: true
			}
			schema: {
				spec: {
					name: string
					url: string
				}
			}
		}
	}
}
