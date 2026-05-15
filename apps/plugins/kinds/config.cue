package plugins

config: {
	codegen: {
		goGenPath: "./pkg/apis"
	}
	definitions: {
		genManifest:                    false
		genCRDs:                        false
		enableOperatorStatusGeneration: true // ???? do we always want this?
	}
	kinds: {
		grouping: "group"
	}
}
