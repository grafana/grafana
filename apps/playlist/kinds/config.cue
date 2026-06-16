package playlist

config: {
	codegen: {
		goGenPath: "./pkg/apis"
	}
	definitions: {
		genManifest: false
		genCRDs:     false
	}
	kinds: {
		grouping: "group"
	}
}
