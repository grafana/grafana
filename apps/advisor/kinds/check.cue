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
				#ErrorLink: {
					// URL to a page with more information about the error
					url: string
					// Human readable error message
					message: string
 				}
				#ReportFailure: {
					// Severity of the failure
					severity: "high" | "low"
					// Step ID that the failure is associated with
					stepID: string
					// Human readable identifier of the item that failed
					item: string
					// Links to actions that can be taken to resolve the failure
					links: [...#ErrorLink]
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
