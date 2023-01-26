package kind

name:     "Star"
maturity: "merged"


lineage: seqs: [
	{
		schemas: [
			// v0.0
			{
				// UserID is the ID of an user the star belongs to.
				userId: int64
				// ID of the star.
				id: int64
				// DashboardID is the id of the dashboard which is starred.
				dashboardId: int64
			},
		]
	},
]
