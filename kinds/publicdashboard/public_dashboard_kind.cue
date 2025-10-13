package kind

name:        "PublicDashboard"
maturity:    "merged"
description: "Public dashboard configuration"

lineage: schemas: [{
	version: [0, 0]
	schema: {
		spec: {
			// Unique public dashboard identifier
			uid: string
			// Dashboard unique identifier referenced by this public dashboard
			dashboardUid: string
			// Unique public access token
			accessToken?: string
			// Flag that indicates if the public dashboard is enabled
			isEnabled: bool
			// Flag that indicates if annotations are enabled
			annotationsEnabled: bool
			// Flag that indicates if the time range picker is enabled
			timeSelectionEnabled: bool
		} @cuetsy(kind="interface")
	}
}]
