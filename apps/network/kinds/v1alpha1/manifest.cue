package v1alpha1

network: {
	kind:       "Network"
	pluralName: "Networks"
	scope:      "Namespaced"
	validation: operations: ["CREATE", "UPDATE"]
	schema: {
		spec:   NetworkSpec
		status: NetworkStatus
	}
}

manifest: {
	kinds: [network]
	codegen: {
		ts: {
			enabled: true
		}
		go: {
			enabled: true
		}
	}
}
