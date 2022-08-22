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
				// Unique numeric identifier for the playlist.
				// TODO: Isolate or remove identifiers local to a Grafana instance
				id?: int64 @reviewme()
				// Unique playlist identifier. Generated on creation, either by the
				// creator of the playlist of by the application.
				uid?: *"" | string & len(uid)<=80 @reviewme()
				// Name of the playlist.
				name?: *"" | string & len(name)<=255 @reviewme()
				// Interval
				// TODO: Figure out the type of this, and validate that it's how long between shifts between items in the playlist.
				interval?: *"5m" | string & len(interval)<=255 @reviewme()
				// Playlist item
				items?: #Items

				///////////////////////////////////////
				// Definitions (referenced above) are declared below

				#Items: {
					// Unique numeric identifier for the item references by the playlist.
					// TODO: Isolate or remove identifiers local to a Grafana instance
					id?: int64 @reviewme()
					// Unique identifier for the item references by the playlist.
					uid?: string
					// Type of the item.
					type?: "dashboard_by_id" | "dashboard_by_tag" | "dashboard_by_uid"
					// Title of the playlist item.
					title?: string
					// TODO: What is this? Is this what's used for dashboard_by_tag?
					value?: string
					// Order determines the weight of the item when displaying the items.
					// TODO: Docs
					order?: *0 | int64
				}
			}
		]
	}
]
