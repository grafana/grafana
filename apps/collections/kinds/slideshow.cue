package preferences

slideshowV1alpha1: {
	kind:       "Slideshow"
	pluralName: "Slideshows"
	scope:      "Namespaced"

	// Slideshows are shared within an org and the list page reads them with a plain list, so
	// nothing needs the generic search route or the indexing work behind it.
	search: {
		endpoint: false
	}

	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	schema: {
		#Item: {
			// API group of the object, e.g. dashboard.grafana.app
			group: string
			// Resource (plural) of the object, e.g. dashboards
			resource: string
			// The k8s name of the object
			name: string
			// Optional per-item display interval (e.g. "30s", "2m"). When unset, the
			// slideshow's spec.interval is used.
			interval?: string
		}
		spec: {
			title: string
			// How long each item is shown, e.g. "5m"
			interval: string
			// Played in order
			// +listType=atomic
			items: [...#Item]
		}
	}
}
