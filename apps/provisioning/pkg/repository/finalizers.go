package repository

// RemoveOrphanResourcesFinalizer removes everything this repo created
const RemoveOrphanResourcesFinalizer = "remove-orphan-resources"

// ReleaseOrphanResourcesFinalizer removes the metadata for anything this repo created
const ReleaseOrphanResourcesFinalizer = "release-orphan-resources"

// CleanFinalizer calls the "OnDelete" function for resource
const CleanFinalizer = "cleanup"

// RemovePendingJobsFinalizer clears the repository's job queue by deleting all queued
// jobs that are not currently being executed.
const RemovePendingJobsFinalizer = "remove-pending-jobs"

var SupportedFinalizers = []string{
	RemoveOrphanResourcesFinalizer,
	ReleaseOrphanResourcesFinalizer,
	RemovePendingJobsFinalizer,
	CleanFinalizer,
}
