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
				_groupSettings : {
					group_by?: [...string]
					group_wait?: string
					group_interval?:  string
					repeat_interval?: string
				}
				#RouteDefaults: close({
					_groupSettings
					receiver: string
				})
				#Matcher: {
					 type: "=" |"!="|"=~"|"!~" @cuetsy(kind="enum")
					 label: string
					 value: string
				}
				// LeafRoute is a route that does not have any sub-routes
				#LeafRoute: close({
					_groupSettings
					receiver?: string
					matchers?: [...#Matcher]
					continue: bool
					mute_time_intervals?: [...string]
				})
				#Route: close({
					#LeafRoute
					routes?: [...#Route2]
				})
				#Route2: close({
					#LeafRoute
					routes?: [...#Route3]
				})
				#Route3: close({
					#LeafRoute
					routes?: [...#Route4]
				})
				#Route4: close({
					#LeafRoute
					routes?: [...#Route5]
				})
				#Route5: close({
					#LeafRoute
					routes?: [...#Route6]
				})
				#Route6: close({
					#LeafRoute
					routes?: [...#LeafRoute]
				})
				spec: {
					 defaults: #RouteDefaults
					 routes: [...#Route]
				}
			}
		}
	}
}