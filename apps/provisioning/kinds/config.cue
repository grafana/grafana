package repository

config: {
	codegen: {
		// The kinds are still served from hand-written Go types; only the manifest is generated.
		goEnabled:                      false
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
