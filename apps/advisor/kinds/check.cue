package advisor

check: {
	kind:	   "Check"
	pluralName: "Checks"
	current:	"v0alpha1"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: true
				backend:  true
			}
			validation: {
				operations: [
					"CREATE",
					"UPDATE",
				]
			}
			schema: {
				#Data: {
					// Generic data input that a check can receive
					data?: [string]: string
				}
				#ReportError: {
					// Severity of the error
					severity: "high" | "low"
					// Human readable reason for the error
					reason: string
					// Action to take to resolve the error
					action: string
					// Step ID that the error is associated with
					stepID: string
					// Item ID that the error is associated with
					itemID: string
				}	
				#Report: {
						// Number of elements analyzed
						count: int
						// List of errors
						errors: [...#ReportError]
				}
				spec: #Data
				status: {
					report: #Report
				}
			}
		}
	}
}
