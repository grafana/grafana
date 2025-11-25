package kinds

quotav0alpha1: {
	kind:  "Quota"  // note: must be uppercase
	schema: {
		spec: {
			count:  string
			limit:  string
			kind:  string
		}
	}
}
