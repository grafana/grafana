package kind

name: "Preferences"
maturity: "merged"

lineage: seqs: [
	{
		schemas: [
			{//0.0
				// UID for the home dashboard
				home_dashboard?: string

				// The timezone selection
				timezone?: string

				// day of the week (sunday, monday, etc)
				week_start?: string

				// light, dark, empty is default
				theme?: string

				// 
				locale?: string

				// Selected language (beta)
				language?: string

				navbar?: #NavbarPreference

				queryHistory?: #QueryHistoryPreference

				#NavLink: {
					id: string
					text?: string
					URL?: string
					target?: string
				} @cuetsy(kind="interface")

				#NavbarPreference: {
					savedItems?: [...#NavLink]
				} @cuetsy(kind="interface")

				#QueryHistoryPreference: {
					homeTab?: string
				} @cuetsy(kind="interface")
			}
		]
	}
]
