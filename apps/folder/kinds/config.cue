package folder

config: {
	codegen: {
		goGenPath:                      "./pkg/apis"
		enableOperatorStatusGeneration: false
	}
	definitions: {
		manifestSchemas: false
		genManifest:     false
		genCRDs:         false
	}
	kinds: {
		grouping: "group"
	}
}
