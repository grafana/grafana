package usertoken

import "github.com/grafana/thema"

thema.#Lineage
name: "usertoken"
seqs: [
	{
		schemas: [
			{
				AuthToken?:     string
				AuthTokenSeen?: bool
				ClientIp?:      string
				CreatedAt?:     int
				Id?:            int
				PrevAuthToken?: string
				RevokedAt?:     int
				RotatedAt?:     int
				SeenAt?:        int
				UnhashedToken?: string
				UpdatedAt?:     int
				UserAgent?:     string
				UserId?:        int
			},
		]
	},
]
