package advisor

check: {
	kind:	   "Check"
	pluralName: "Checks"
	current:	"v0alpha1"
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
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
					// ID of the item that failed
					itemID: string
					// Links to actions that can be taken to resolve the failure
					links: [...#ErrorLink]
					// More information about the failure, not meant to be displayed to the user. Used for LLM suggestions.
					moreInfo?: string
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
