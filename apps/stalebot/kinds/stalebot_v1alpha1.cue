package kinds

staledashboardtrackerv1alpha1: staledashboardtrackerBase & {
	schema: {
		spec: {
			// Dashboard UID to track
			dashboardUID: string

			// Threshold in days after which a dashboard is considered stale
			// if not viewed or updated
			staleDaysThreshold: int32 & >=1 & <=365

			// Whether to check view activity
			trackViews: bool | *true

			// Whether to check update activity
			trackUpdates: bool | *true

			// Optional notification settings
			notification?: {
				enabled: bool
				channels?: [...string]
			}
		}

		status: {
			// Current stale state
			isStale: bool

			// Last time the dashboard was accessed
			lastAccessedTime?: string

			// Last time the dashboard was updated
			lastUpdatedTime?: string

			// Number of days since last activity
			daysSinceActivity?: int32

			// Last check timestamp
			lastCheckedTime?: string

			// Observed generation
			observedGeneration?: int64

			// Conditions
			conditions?: [...{
				type: string
				status: string
				reason?: string
				message?: string
				lastTransitionTime?: string
			}]
		}
	}
}
