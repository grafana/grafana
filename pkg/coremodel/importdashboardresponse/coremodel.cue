package importdashboardresponse

import "github.com/grafana/thema"

thema.#Lineage
name: "importdashboardresponse"
seqs: [
	{
		schemas: [
			{
				dashboardId?:      int
				description?:      string
				folderId?:         int
				imported?:         bool
				importedRevision?: int
				importedUri?:      string
				importedUrl?:      string
				path?:             string
				pluginId?:         string
				removed?:          bool
				revision?:         int
				slug?:             string
				title?:            string
				uid?:              string
			},
		]
	},
]
