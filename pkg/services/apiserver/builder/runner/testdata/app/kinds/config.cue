package core

config: {
	codegen: {
		goGenPath:               "./pkg/apis"
		enableK8sPostProcessing: true
	}
	definitions: {
		genManifest: false
		genCRDs:     false
	}
	kinds: {
		grouping: "group"
	}
}
