package core

route: {
	kind:  "RoutingTree"
	group: "notifications"
	apiResource: {
		groupOverride: "notifications.alerting.grafana.app"
	}
	codegen: {
		frontend: false
		backend:  true
	}
	pluralName: "RoutingTrees"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				#RouteDefaults: {
					receiver: string
					group_by?: [...string]
					group_wait?: string
					group_interval?:  string
					repeat_interval?: string
				}
				#Matcher: {
					 type: "=" |"!="|"=~"|"!~" @cuetsy(kind="enum")
					 label: string
					 value: string
				}
				#Route: {
					receiver?: string
					matchers?: [...#Matcher]
					continue: bool

					group_by?: [...string]
					mute_time_intervals?: [...string]
					routes?: [...#Route]
					group_wait?: string
					group_interval?:  string
					repeat_interval?: string
				}
				spec: {
					 defaults: #RouteDefaults
					 routes: [...#Route]
				}
			}
		}
	}
}