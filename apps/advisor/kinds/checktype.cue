package advisor

checktype: {
	kind:		"CheckType"
	pluralName:	"CheckTypes"
	current:	"v0alpha1"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
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
	}
}
