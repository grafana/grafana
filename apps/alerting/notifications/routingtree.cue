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
	pluralName: "RoutingTree"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				#Matcher: {
					 type: "="|"!="|"=~"|"!~" @cuetsy(kind="enum")
					 name: string
					 value: string
				}
				#SubRoute: {
					receiver?: string
					matchers?: [...#Matcher]
					continue?: bool

					group_by?: [...string]
					mute_time_intervals?: [...string]
					routes?: [...#SubRoute]
					group_wait?: string
					group_interval?:  string
					repeat_interval?: string
				}
				#Route: {
					receiver: string

					group_by?: [...string]
					routes?: [...#SubRoute]
					group_wait?: string
					group_interval?:  string
					repeat_interval?: string
				}
				spec: {
					 route: #Route
				}
			}
		}
	}
}