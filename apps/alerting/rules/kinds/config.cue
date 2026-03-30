package kinds

config: {
	codegen: {
		goGenPath:               "./pkg/apis"
		enableK8sPostProcessing: true
	}
	definitions: {
		encoding: "yaml"
	}
	kinds: {
		grouping: "group"
	}
}
