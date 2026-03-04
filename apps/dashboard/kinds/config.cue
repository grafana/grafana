package kinds

config: {
	codegen: {
		goGenPath:                      "./pkg/apis"
		tsGenPath:                      "../../packages/grafana-schema/src/schema"
		enableOperatorStatusGeneration: false
	}
	definitions: {
		genManifest: false
		genCRDs:     false
	}
	kinds: {
		grouping: "group"
	}
}
