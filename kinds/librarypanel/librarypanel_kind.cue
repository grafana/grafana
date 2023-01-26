package kind

import "strings"

name:     "LibraryPanel"
maturity: "experimental"

lineage: seqs: [
	{
		schemas: [
			// 0.0
			{
				@grafana(TSVeneer="type")

				// TODO: remove, should not be externally defined
				id: int64

				// TODO: remove, should not be externally defined
				orgId: int64 @grafanamaturity(ToMetadata="sys")

				// TODO -- remove... do not expose internal ID
				folderId: int64 @grafanamaturity(ToMetadata="sys")

				// Folder UID
				folderUid: string @grafanamaturity(ToMetadata="sys")

				// TODO, remove?  always 1
				kind: int64

				// Library element UID
				uid: string

				// Panel name (also saved in the model)
				name: string & strings.MinRunes(1)

				// Panel description (ideally optional, but avoid pointer issues)
				description: string

				// The panel type (from inside the model)
				type: string & strings.MinRunes(1)

				// Dashboard version when this was saved
				schemaVersion: uint16 | *36

				// panel version, incremented each time the dashboard is updated.
				version: int64 @grafanamaturity(NeedsExpertReview)

				// TODO: this should the same panel type as defined inside dashboard
				model: _

				// Object storage metadata
				meta?: #LibraryElementDTOMeta

				#LibraryElementDTOMetaUser: {
					id:        int64
					name:      string
					avatarUrl: string
				} @cuetsy(kind="interface") @grafanamaturity(NeedsExpertReview)

				#LibraryElementDTOMeta: {
					folderName:          string
					folderUid:           string @grafanamaturity(ToMetadata="sys")
					connectedDashboards: int64

					created: int64 // was time.Time and string in frontend
					updated: int64 // was time.Time and string in frontend

					createdBy: #LibraryElementDTOMetaUser @grafanamaturity(ToMetadata="sys")
					updatedBy: #LibraryElementDTOMetaUser @grafanamaturity(ToMetadata="sys")
				} @cuetsy(kind="interface") @grafanamaturity(NeedsExpertReview)
			},
		]
	},
]
