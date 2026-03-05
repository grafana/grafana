package kinds

config: {
	codegen: {
		goGenPath:                      "./pkg/apis"
		enableOperatorStatusGeneration: false
		enableK8sPostProcessing:        true
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
