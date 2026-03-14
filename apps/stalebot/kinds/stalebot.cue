package kinds

staledashboardtrackerBase: {
	kind: "StaleDashboardTracker"
	pluralName: "StaleDashboardTrackers"
	scope: "Namespaced"

	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	mutation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	conversion: false

	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
}
