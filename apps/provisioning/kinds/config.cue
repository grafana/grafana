package repository

config: {
	codegen: {
		// v0alpha1 and v1beta1 are served from hand-written Go types and disable Go per version.
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
