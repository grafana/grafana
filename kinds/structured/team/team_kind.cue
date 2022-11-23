package kind

name: "Team"
maturity: "merged"

lineage: seqs: [
	{
		schemas: [
			// v0.0
			// TODO docs
			{
				id?: int
				orgId?: int @grafanamaturity(MaybeRemove)
				name: string
				email: string
				avatarUrl: string @grafanamaturity(MaybeRemove)
				memberCount: int @grafanamaturity(MaybeRemove)
				permission: #Permission @grafanamaturity(MaybeRemove)
				accessControl: [string]: bool @grafanamaturity(MaybeRemove)

				#Permission: 1 | 2 | 4 @cuetsy(kind="enum",memberNames="viewer|editor|admin")
			},

		]
	},
]
