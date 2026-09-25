package advisor

checktypev0alpha1: {
	kind:   "CheckType"
	plural: "checktypes"
	scope:  "Namespaced"

	// Off until the advisor squad asks for it: check types are a fixed, tiny set
	// that callers list rather than search.
	search: {
		endpoint: false
	}
	schema: {
		#Step: {
			title:       string
			description: string
			stepID:      string
			resolution:  string
		}
		spec: {
			name: string
			steps: [...#Step]
		}
	}
}
