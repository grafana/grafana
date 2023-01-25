package kind

name:     "Preference"
maturity: "merged"

lineage: seqs: [
	{
		schemas: [
			//0.0
			{
				// Numeric unique identifier for the home dashboard
				homeDashboardId?: int64

				// Unique identifier for the home dashboard
				homeDashboardUID?: string

				// Timezone preference
				timezone?: "utc" | "browser"

				// Starting day of the week
				weekStart?: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"

				// Theme preference
				theme?: "dark" | "light"

				// Language preference
				language?: string

				navbar?: #NavbarPreference

				// Explore query history preferences
				queryHistory?: #QueryHistoryPreference

				#NavbarPreference: {
					savedItems: [...#NavLink]
				} @cuetsy(kind="interface")

				#NavLink: {
					id?:     string
					text?:   string
					url?:    string
					target?: string
				} @cuetsy(kind="interface")

				#QueryHistoryPreference: {
					homeTab?: string
				} @cuetsy(kind="interface")
			},
		]
	},
]
