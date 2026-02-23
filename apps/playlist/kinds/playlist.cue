package playlist

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

playlistv0alpha1: {
	kind:   "Playlist"
	plural: "playlists"
	scope:  "Namespaced"
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
		}
	}
}

playlistv1: {
	kind:   "Playlist"
	plural: "playlists"
	scope:  "Namespaced"
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
		}
	}
}
