package kv

import "slices"

const (
	DataSection                   = "unified/data"
	EventsSection                 = "unified/events"
	LastImportTimeSection         = "unified/lastimport"
	PendingDeleteSection          = "unified/pendingdelete"
	LeasesSection                 = "unified/leases"
	SearchSnapshotManifestSection = "search/snapshot-manifest"
	SearchSnapshotDataSection     = "search/snapshot-data"
	StatsDailySection             = "stats/daily"
	StatsAggregatesSection        = "stats/aggregates"
	NATSPeersSection              = "nats/peers"
	VersionPolicySection          = "apiserver/versionpolicy"
	BlobDataSection               = "unified/blob-data"
)

// Keep AllSections sorted by value for binary search validation.
var AllSections = []string{
	VersionPolicySection,
	NATSPeersSection,
	SearchSnapshotDataSection,
	SearchSnapshotManifestSection,
	StatsAggregatesSection,
	StatsDailySection,
	BlobDataSection,
	DataSection,
	EventsSection,
	LastImportTimeSection,
	LeasesSection,
	PendingDeleteSection,
}

func IsSupportedSection(section string) bool {
	_, found := slices.BinarySearch(AllSections, section)
	return found
}
