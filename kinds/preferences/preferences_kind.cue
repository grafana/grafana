package kind

import "github.com/grafana/grafana/packages/grafana-schema/src/common"

name: "Preferences"
maturity: "merged"

lineage: seqs: [
	{
		schemas: [
			{//0.0
				// UID for the home dashboard
				homeDashboardUID?: string

				// The timezone selection
				timezone?: common.TimeZone

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
				} @cuetsy(kind="interface")
			}
		]
	}
]
