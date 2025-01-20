package advisor

datasourcecheck: {
	kind:	   "Check"
	pluralName: "Checks"
	current:	"v0alpha1"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: false
				backend:  true
			}
			schema: {
				spec: {
					// Generic data input that a check can receive
					data?: [string]: string
				}
				status: {
					report: {
						// Number of elements analyzed
						count: int
						// List of errors
						errors: [...{
							// Investigation or Action recommended (severity of the error)
							type: "investigation" | "action"
							// Human readable reason for the error
							reason: string
							// Action to take to resolve the error
							action: string
						}]
					}
				}
			}
		}
	}
}
