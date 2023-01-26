package kind

name:     "APIKey"
maturity: "merged"

lineage: seqs: [
	{
		schemas: [
			// v0.0
			{
				// ID is the unique identifier of the api key in the database.
				id: int64 @grafanamaturity(ToMetadata="sys")
				// Name of the api key.
				name: string
				// Role is the Grafana organization role of the api key which can be 'Viewer', 'Editor', 'Admin'.
				role: #OrgRole @grafanamaturity(ToMetadata="kind")
				// Expiration indicates when the api key expires.
				expiration?: int64 @grafanamaturity(ToMetadata="sys")
				// AccessControl metadata associated with a given resource.
				accessControl?: {
					[string]: bool @grafanamaturity(ToMetadata="sys")
				}

				// OrgRole is a Grafana Organization Role which can be 'Viewer', 'Editor', 'Admin'.
				#OrgRole: "Admin" | "Editor" | "Viewer" @cuetsy(kind="type")
			},
		]
	},
]
