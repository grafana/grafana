package plugins

config: {
	codegen: {
		goGenPath: "./pkg/apis"

		// should this apply to everything?
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
