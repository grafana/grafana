package advisor

#CheckData: {
	// Generic data input that a check can receive
	data?: [string]: string
}

#CheckReport: {
    // Number of elements analyzed
    count: int
    // List of errors
    errors: [...{
		// Investigation or Action recommended
    	type: "investigation" | "action"
    	// Reason for the error
    	reason: string
    	// Action to take
    	action: string
	}]
}
