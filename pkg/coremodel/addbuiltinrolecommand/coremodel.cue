package addbuiltinrolecommand

import "github.com/grafana/thema"

thema.#Lineage
name: "addbuiltinrolecommand"
seqs: [
	{
		schemas: [
			{
				builtInRole?: "Viewer" | " Editor" | " Admin" | " Grafana Admin"

				// A flag indicating if the assignment is global or not. If set to
				// false, the default org ID of the authenticated user will be
				// used from the request to create organization local assignment.
				// Refer to the Built-in role assignments for more information.
				global?:  bool
				roleUid?: string
			},
		]
	},
]
