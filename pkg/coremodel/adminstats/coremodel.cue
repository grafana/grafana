package adminstats

import "github.com/grafana/thema"

thema.#Lineage
name: "adminstats"
seqs: [
	{
		schemas: [
			{
				activeAdmins?:        int
				activeEditors?:       int
				activeSessions?:      int
				activeUsers?:         int
				activeViewers?:       int
				admins?:              int
				alerts?:              int
				dailyActiveAdmins?:   int
				dailyActiveEditors?:  int
				dailyActiveSessions?: int
				dailyActiveUsers?:    int
				dailyActiveViewers?:  int
				dashboards?:          int
				datasources?:         int
				editors?:             int
				monthlyActiveUsers?:  int
				orgs?:                int
				playlists?:           int
				snapshots?:           int
				stars?:               int
				tags?:                int
				users?:               int
				viewers?:             int
			},
		]
	},
]
