package playlist

import (
	"github.com/grafana/thema"
)

thema.#Lineage
name: "playlist"
seqs: [
	{
		schemas: [
			{//0.0
				// Unique playlist identifier for internal use, set by Grafana.
				id: int64 @grafana(decisionNeeded)
				// Unique playlist identifier. Generated on creation, either by the
				// creator of the playlist of by the application.
				uid: string
				// Name of the playlist.
				name: string
				// Interval sets the time between switching views in a playlist.
				// FIXME: Is this based on a standardized format or what options are available? Can datemath be used?
				interval: string | *"5m"
				// The ordered list of items that the playlist will iterate over.
				items?: [...#PlaylistItem]

				///////////////////////////////////////
				// Definitions (referenced above) are declared below

				#PlaylistItem: {
					// FIXME: The prefixDropper removes playlist from playlist_id, that doesn't work for us since it'll mean we'll have Id twice.
					// ID of the playlist item for internal use by Grafana. Deprecated.
					id: int64 @grafana(decisionNeeded)
					// PlaylistID for the playlist containing the item. Deprecated.
					playlistid: int64 @grafana(decisionNeeded)

					// Type of the item.
					type: "dashboard_by_uid" | "dashboard_by_id" | "dashboard_by_tag"
					// Value depends on type and describes the playlist item.
					//
					//  - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This
					//  is not portable as the numerical identifier is non-deterministic between different instances.
					//  Will be replaced by dashboard_by_uid in the future.
					//  - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All
					//  dashboards behind the tag will be added to the playlist.
					value: string
					// Title is the human-readable identifier for the playlist item.
					title: string @grafana(decisionNeeded)
					// Order is the position in the list for the item. Deprecated.
					order: int64 | *0 @grafana(decisionNeeded)
				}
			}
		]
	}
]
