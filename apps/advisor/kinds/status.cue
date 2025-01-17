package advisor

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