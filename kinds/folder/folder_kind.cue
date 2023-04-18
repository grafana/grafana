package kind

name:        "Folder"
maturity:    "merged"
description: "A collection of items together"

lineage: seqs: [
	{
		schemas: [
			//0.0
			{
				// Unique folder id.
				uid: string

				// Folder title
				title: string

				// Description of the folder.
				description?: string
			},
		]
	},
]
