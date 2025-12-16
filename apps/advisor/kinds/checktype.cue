package advisor

checktypev0alpha1: {
	kind:   "CheckType"
	plural: "checktypes"
	scope:  "Namespaced"
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
