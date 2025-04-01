package advisor

checktype: {
	kind:       "CheckType"
	pluralName: "CheckTypes"
	current:    "v0alpha1"

	codegen: {
		go: {
			enabled: true
		}
		ts: {
			enabled: true
		}
	}

	versions: {
		"v0alpha1": {
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
	}
}
