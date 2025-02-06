package advisor

checktype: {
	kind:		"CheckType"
	pluralName:	"CheckTypes"
	current:	"v0alpha1"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: false
				backend:  true
			}
			schema: {
				#Step: {
					title:			string
					description:	string
					stepID:			string
				}	
				spec: {
					name: 	string
					steps:	[...#Step]
				}
			}
		}
	}
}
