package repository

// RemoveOrphanResourcesFinalizer removes everything this repo created
const RemoveOrphanResourcesFinalizer = "remove-orphan-resources"

// ReleaseOrphanResourcesFinalizer removes the metadata for anything this repo created
const ReleaseOrphanResourcesFinalizer = "release-orphan-resources"

// CleanFinalizer calls the "OnDelete" function for resource
const CleanFinalizer = "cleanup"
