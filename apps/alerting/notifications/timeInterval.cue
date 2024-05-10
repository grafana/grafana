package core

timeInterval: {
	kind:  "TimeInterval"
	group: "notifications"
	apiResource: {
		groupOverride: "notifications.alerting.grafana.app"
	}
	codegen: {
		frontend: false
		backend:  true
	}
	pluralName: "TimeIntervals"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				#TimeRange: {
					startMinute: string
					endMinute: string
				}
				#Interval: {
					times?: [...#TimeRange]
					weekdays?: [...string]
					daysOfMonth?: [...string]
					months?: [...string]
					years?: [...string]
					location?: string
				}
				spec: {
					intervals: [...#Interval]
				}
			}
		}
	}
}