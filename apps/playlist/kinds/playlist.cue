package playlist

// A named set of dashboard query parameters (variables and time range) applied during playlist playback
#PlaylistVariableSet: {
	// Optional display name for this variable set.
	name?: string
	// Query parameters to append when opening each playlist dashboard. Use var-<name> for dashboard variables and from/to for time range overrides.
	queryParams: [string]: string
}

// Shared item definition for all versions
#PlaylistItem: {
	// type of the item.
	type: "dashboard_by_tag" | "dashboard_by_uid" | "dashboard_by_id"
	// Value depends on type and describes the playlist item.
	//  - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This
	//  is not portable as the numerical identifier is non-deterministic between different instances.
	//  Will be replaced by dashboard_by_uid in the future. (deprecated)
	//  - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All
	//  dashboards behind the tag will be added to the playlist.
	//  - dashboard_by_uid: The value is the dashboard UID
	value: string
}

playlistv1: {
	kind:       "Playlist"
	plural:     "playlists"
	scope:      "Namespaced"
	conversion: true
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
	schema: {
		#Item: #PlaylistItem
		spec: {
			title:    string
			interval: string
			items: [...#Item]
			variableSets?: [...#PlaylistVariableSet]
		}
	}
}
