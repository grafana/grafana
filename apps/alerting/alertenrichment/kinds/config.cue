package kinds

config: {
	codegen: {
		goGenPath:                      "./pkg/generated"
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
