package kv

import "slices"

const (
	DataSection                   = "unified/data"
	EventsSection                 = "unified/events"
	LastImportTimeSection         = "unified/lastimport"
	LatestSection                 = "unified/latest"
	PendingDeleteSection          = "unified/pendingdelete"
	LeasesSection                 = "unified/leases"
	SearchSnapshotManifestSection = "search/snapshot-manifest"
	SearchSnapshotDataSection     = "search/snapshot-data"
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
	BlobDataSection,
	DataSection,
	EventsSection,
	LastImportTimeSection,
	LatestSection,
	LeasesSection,
	PendingDeleteSection,
}

func IsSupportedSection(section string) bool {
	_, found := slices.BinarySearch(AllSections, section)
	return found
}

// unbatchedSections hold values a store may keep outside its transactional
// storage, such as in blob storage, so their operations can't be part of an
// atomic Batch. SqlKV also keeps last import times in a table of its own.
var unbatchedSections = []string{
	BlobDataSection,
	LastImportTimeSection,
	SearchSnapshotDataSection,
	SearchSnapshotManifestSection,
}

// SupportsBatch reports whether Batch operations may target section.
func SupportsBatch(section string) bool {
	return !slices.Contains(unbatchedSections, section)
}
