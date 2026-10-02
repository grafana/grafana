package playlist

import "strings"

// Dashboard view state applied to a playlist item during playback.
#DashboardView: {
	// Normalized URL query string containing dashboard variables, time range, and other
	// view state. It does not include a leading question mark, URL fragment, host, or path.
	// +k8s:validation:minLength=1
	queryString: string & strings.MinRunes(1)
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
	// Optional per-item display interval (e.g. "30s", "2m"). When unset, the
	// playlist's global spec.interval is used.
	interval?: string
	// Optional dashboard view applied during playback.
	dashboardView?: #DashboardView
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
		}
	}
}
