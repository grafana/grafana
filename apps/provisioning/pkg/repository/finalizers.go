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

// ForceDeleteAnnotation, when set to "true" on a Repository marked for deletion,
// tells the controller to complete deletion even if the repository cannot be
// built from its configuration (for example, because its credentials have
// expired). Provider-side cleanup that needs a working client — notably webhook
// removal — is skipped, so those remote resources are left in place rather than
// blocking removal of the repository object forever.
const ForceDeleteAnnotation = "provisioning.grafana.app/force-delete"

// IsForceDelete reports whether the force-delete annotation is set to "true" on
// the given object annotations.
func IsForceDelete(annotations map[string]string) bool {
	return annotations[ForceDeleteAnnotation] == "true"
}
