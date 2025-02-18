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
				#ReportFailure: {
					// Severity of the failure
					severity: "high" | "low"
					// Human readable reason for the failure
					reason: string
					// Action to take to resolve the failure
					action: string
					// Step ID that the failure is associated with
					stepID: string
					// Item ID that the failure is associated with
					itemID: string
				}	
				#Report: {
						// Number of elements analyzed
						count: int
						// List of failures
						failures: [...#ReportFailure]
				}
				spec: #Data
				status: {
					report: #Report
				}
			}
		}
	}
}
