package advisor2

checktypev0alpha1: {
	kind:   "CheckType"
	plural: "checktypes"
	scope:  "Namespaced"
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	schema: {
		#Step: {
			title:			string
			description:	string
			stepID:			string
			resolution:		string
		}	
		spec: {
			name: 	string
			steps:	[...#Step]
		}
	}
}
