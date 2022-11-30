package kind

name: "Folder"
maturity: "merged"

lineage: seqs: [
	{
		schemas: [
			{//0.0
				// OrgId is the ID of an organisation the folder belongs to.
				orgId: int64 @grafanamaturity(ToMetadata="sys")
				// Uid is the unique numeric identifier for the folder.
				uid: string
				// Title of the folder.
				title: string
				// TODO
				url: string
				// Description of the folder.
				description?: string
				// ParentUid of the enclosing folder if nested folders are enabled.
				parentUid?: string
				// HasAcl indicates whether custom permissions are set for the folder.
				hasAcl: bool @grafanamaturity(ToMetadata="kind", MaybeRemove)
				// TODO
				canSave: bool @grafanamaturity(ToMetadata="kind", MaybeRemove)
				// TODO
				canAdmin: bool @grafanamaturity(ToMetadata="kind", MaybeRemove)
				// TODO
				canEdit: bool @grafanamaturity(ToMetadata="kind", MaybeRemove)
				// TODO
				canDelete: bool @grafanamaturity(ToMetadata="kind", MaybeRemove)
				// CreatedBy is the ID of a user who created the folder.
				createdBy: int64 @grafanamaturity(ToMetadata="sys")
				// Create is the date when folder was created.
				created: string @grafanamaturity(ToMetadata="sys")
				// UpdatedBy is the ID of a user who modified the folder most recently.
				updatedBy: int64 @grafanamaturity(ToMetadata="sys")
				// Update is the date of the most recent folder update.
				updated: string @grafanamaturity(ToMetadata="sys")
				// Version of the folder, incremented each time it is updated.
				version: int64 @grafanamaturity(ToMetadata="kind", MaybeRemove)
				// AccessControl metadata associated with a given resource.
				accessControl: [string]: bool @grafanamaturity(ToMetadata="sys")
			}
		]
	}
]

