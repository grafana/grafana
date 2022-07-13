package createlibraryelementcommand

import "github.com/grafana/thema"

thema.#Lineage
name: "createlibraryelementcommand"
seqs: [
	{
		schemas: [
			{
				// ID of the folder where the library element is stored.
				folderId?: int

				// UID of the folder where the library element is stored.
				folderUid?: string

				// Kind of element to create, Use 1 for library panels or 2 for c.
				// Description:
				// 1 - library panels
				// 2 - library variables
				kind?: (1 | 2) & {
					int
				}

				// The JSON model for the library element.
				model?: {
					...
				}

				// Name of the library element.
				name?: string
				uid?:  string
			},
		]
	},
]
