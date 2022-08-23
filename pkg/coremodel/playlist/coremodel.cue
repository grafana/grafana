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
				// Unique playlist identifier. Generated on creation, either by the
				// creator of the playlist of by the application.
				uid?: string @reviewme()
				// Name of the playist.
				name?: string @reviewme()
				// Interval
				// TODO: Figure out the type of this, and validate that it's how long between shifts between items in the playlist.
				interval?: string @reviewme()
				// Playlist item
				items?: [...#Items]

				///////////////////////////////////////
				// Definitions (referenced above) are declared below

				#Items: {
					// Type of the item.
					type?: "dashboard_by_id" | "dashboard_by_tag" | "dashboard_by_uid"
					// Title of the playlist item.
					title?: string
					// TODO: What is this? Is this what's used for dashboard_by_tag?
					value?: string
				}
			}
		]
	}
]
