package custompermissionsrecorddto

import "github.com/grafana/thema"

thema.#Lineage
name: "custompermissionsrecorddto"
seqs: [
	{
		schemas: [
			{
				customPermissions?: string
				granteeName?:       string
				granteeType?:       string
				granteeUrl?:        string
				id?:                int
				isFolder?:          bool
				orgId?:             int
				orgRole?:           string
				slug?:              string
				title?:             string
				uid?:               string
				url?:               string
				usersCount?:        int
			},
		]
	},
]
