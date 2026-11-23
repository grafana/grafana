package repository

config: {
	codegen: {
		goGenPath:                      "./pkg/apis"
		enableOperatorStatusGeneration: false
	}
	definitions: {
		genManifest:      true
		genCRDs:          false
		path:             "./definitions"
		manifestFileName: "provisioning-manifest.json"
	}
	kinds: {
		grouping: "group"
	}
}
