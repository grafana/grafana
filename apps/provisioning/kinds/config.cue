package repository

config: {
	codegen: {
		goGenPath:                      "./pkg/apis"
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
