package kind

name:        "Preferences"
maturity:    "merged"
description: "The user or team frontend preferences"

lineage: seqs: [
	{
		schemas: [
			{
				// UID for the home dashboard
				homeDashboardUID?: string

				// The timezone selection
				// TODO: this should use the timezone defined in common
				timezone?: string

				// day of the week (sunday, monday, etc)
				weekStart?: string

				// light, dark, empty is default
				theme?: string

				// Selected language (beta)
				language?: string

				// Explore query history preferences
				queryHistory?: #QueryHistoryPreference

				#QueryHistoryPreference: {
								// one of: '' | 'query' | 'starred';
								homeTab?: string
				} @cuetsy(kind="interface") //0.0
			},
		]
	},
]
