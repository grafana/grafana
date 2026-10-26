// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// +k8s:openapi-gen=true
type PullRequestJobOptions struct {
	// The branch of commit hash
	Ref string `json:"ref,omitempty"`
	// Pull request number (when appropriate)
	PR int `json:"pr,omitempty"`
	// The specific commit hash that triggered this notice
	Hash string `json:"hash,omitempty"`
	// URL to the originator (eg, PR URL)
	URL string `json:"url,omitempty"`
	// Whether the pull request's head repository differs from its base repository.
	// Omitted when repository identities were unavailable, including older jobs.
	IsFork *bool `json:"isFork,omitempty"`
	// URL of the head repository for a pull request from a fork, when available.
	ForkURL string `json:"forkURL,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for PullRequestJobOptions.
func (PullRequestJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.PullRequestJobOptions"
}

// +k8s:openapi-gen=true
type ExportJobOptions struct {
	// Message to use when committing the changes in a single commit.
	// Deprecated: set JobSpec.Message instead. This field is kept for
	// backwards compatibility and is only used when JobSpec.Message is empty.
	Message string `json:"message,omitempty"`
	// The source folder (or empty) to export
	Folder string `json:"folder,omitempty"`
	// Target branch for export (only git)
	Branch string `json:"branch,omitempty"`
	// Prefix in target file system
	Path string `json:"path,omitempty"`
	// Resources to export. When empty, every unmanaged resource in the namespace
	// is exported (legacy behavior). When non-empty, only the listed resources
	// are exported — the folder hierarchy is still emitted so parent paths resolve.
	// Currently only unmanaged Dashboards are supported.
	// +listType=atomic
	Resources []ResourceRef `json:"resources,omitempty"`
	// GenerateNewFolderIDs writes a freshly generated identifier into each
	// exported folder's metadata (_folder.json) instead of preserving the
	// existing folder UID. Use this to produce a portable export that creates
	// new folders on a subsequent sync rather than taking over the originals.
	// Has no effect when folder metadata is not written.
	GenerateNewFolderIDs bool `json:"generateNewFolderIDs,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for ExportJobOptions.
func (ExportJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ExportJobOptions"
}

// +k8s:openapi-gen=true
type ResourceRef struct {
	// Name is the name of the resource, such as a dashboard UID.
	Name string `json:"name,omitempty"`
	// Kind is the type of resource, for example, "Dashboard".
	Kind string `json:"kind,omitempty"`
	// Group is the group of the resource, such as "dashboard.grafana.app".
	Group string `json:"group,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for ResourceRef.
func (ResourceRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ResourceRef"
}

// +k8s:openapi-gen=true
type SyncJobOptions struct {
	// Incremental synchronization for versioned repositories
	Incremental bool `json:"incremental"`
}

// OpenAPIModelName returns the OpenAPI model name for SyncJobOptions.
func (SyncJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.SyncJobOptions"
}

// +k8s:openapi-gen=true
type MigrateJobOptions struct {
	// Message to use when committing the changes in a single commit.
	// Deprecated: set JobSpec.Message instead. This field is kept for
	// backwards compatibility and is only used when JobSpec.Message is empty.
	Message string `json:"message,omitempty"`
	// Target branch for the migration (git only). When set to a branch other
	// than the repository's configured branch, the migration writes the exported
	// resources to that branch (a pull request workflow) and removes the migrated
	// resources from the instance instead of taking ownership of them — they
	// return as managed resources once the branch is merged and a regular sync
	// runs on the configured branch. When empty (or equal to the configured
	// branch), the migration writes directly to the configured branch and takes
	// ownership of the exported resources.
	Branch string `json:"branch,omitempty"`
	// Resources to migrate. When empty, every unmanaged resource in the namespace
	// is migrated (legacy behavior). When non-empty, only the listed resources
	// are exported to the repository — the folder hierarchy is still emitted so
	// parent paths resolve, and the subsequent pull phase only takes ownership
	// of those resources.
	// Currently only unmanaged Dashboards are supported.
	// +listType=atomic
	Resources []ResourceRef `json:"resources,omitempty"`
	// GenerateNewFolderIDs writes a freshly generated identifier into each
	// exported folder's metadata (_folder.json) instead of preserving the
	// existing folder UID. The subsequent pull creates new folders rather than
	// taking over the originals. Has no effect when folder metadata is not written.
	GenerateNewFolderIDs bool `json:"generateNewFolderIDs,omitempty"`
	// SkipResourceDeletion keeps the migrated resources on the instance instead of
	// removing them. By default a migration deletes the resources it moved (the
	// whole namespace for an instance target, or the exported resources for a
	// branch migration); when true, no deletion happens and the resources are
	// left in place.
	SkipResourceDeletion bool `json:"skipResourceDeletion,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for MigrateJobOptions.
func (MigrateJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.MigrateJobOptions"
}

// +k8s:openapi-gen=true
type DeleteJobOptions struct {
	// Ref to the branch or commit hash to delete from
	Ref string `json:"ref,omitempty"`
	// Paths to be deleted. Examples:
	// - dashboard.json (for a file)
	// - a/b/c/other-dashboard.json (for a file)
	// - nested/deep/ (for a directory)
	// +listType=atomic
	Paths []string `json:"paths,omitempty"`
	// Resources to delete
	// This option has been created because currently the frontend does not use
	// standarized app platform APIs. For performance and API consistency reasons, the preferred option
	// is it to use the paths.
	// +listType=atomic
	Resources []ResourceRef `json:"resources,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for DeleteJobOptions.
func (DeleteJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.DeleteJobOptions"
}

// +k8s:openapi-gen=true
type MoveJobOptions struct {
	// Ref to the branch or commit hash that should move
	Ref string `json:"ref,omitempty"`
	// Paths to be deleted. Examples:
	// - dashboard.json (for a file)
	// - a/b/c/other-dashboard.json (for a file)
	// - nested/deep/ (for a directory)
	// +listType=atomic
	Paths []string `json:"paths,omitempty"`
	// Destination path for the move (e.g. "new-location/")
	TargetPath string `json:"targetPath,omitempty"`
	// Resources to move
	// This option has been created because currently the frontend does not use
	// standarized app platform APIs. For performance and API consistency reasons, the preferred option
	// is it to use the paths.
	// +listType=atomic
	Resources []ResourceRef `json:"resources,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for MoveJobOptions.
func (MoveJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.MoveJobOptions"
}

// +k8s:openapi-gen=true
type FixFolderMetadataJobOptions struct {
	// Ref to the branch to create the commit on (uses repository's default branch if not specified)
	Ref string `json:"ref,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for FixFolderMetadataJobOptions.
func (FixFolderMetadataJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.FixFolderMetadataJobOptions"
}

// TestJobOptions configures a synthetic performance-testing job. The job does
// no real work; it sleeps for Duration and then completes. It is only usable
// when the provisioning.performance feature flag is enabled.
// +k8s:openapi-gen=true
type TestJobOptions struct {
	// Duration is how long the job should sleep before completing, expressed as
	// a Go duration string (for example "10s" or "2m"). It must be positive and
	// is capped by the server to keep a single job's runtime predictable.
	Duration metav1.Duration `json:"duration,omitempty"`
	// ProgressUpdates controls how many progress notifications the job emits
	// while running. A value of 0 uses the server default.
	ProgressUpdates int `json:"progressUpdates,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for TestJobOptions.
func (TestJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.TestJobOptions"
}

// +k8s:openapi-gen=true
type JobSpec struct {
	Action JobAction `json:"action"`
	// The the repository reference (for now also in labels)
	// This value is required, but will be popuplated from the job making the request
	Repository string `json:"repository,omitempty"`
	// Commit message for this job. Applies to job actions that produce
	// commits (delete, move, migrate, push, fixFolderMetadata).
	// When empty, the backend falls back to the action-specific message
	// field (ExportJobOptions.Message, MigrateJobOptions.Message) for
	// backwards compatibility, then to a built-in default.
	Message string `json:"message,omitempty"`
	// Pull request options
	PullRequest *PullRequestJobOptions `json:"pr,omitempty"`
	// Required when the action is `push`
	Push *ExportJobOptions `json:"push,omitempty"`
	// Required when the action is `pull`
	Pull *SyncJobOptions `json:"pull,omitempty"`
	// Required when the action is `migrate`
	Migrate *MigrateJobOptions `json:"migrate,omitempty"`
	// Delete when the action is `delete`
	Delete *DeleteJobOptions `json:"delete,omitempty"`
	// Move when the action is `move`
	Move *MoveJobOptions `json:"move,omitempty"`
	// Options when the action is `fix-folder-metadata`
	FixFolderMetadata *FixFolderMetadataJobOptions `json:"fixFolderMetadata,omitempty"`
	// Required when the action is `test`
	Test *TestJobOptions `json:"test,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for JobSpec.
func (JobSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.JobSpec"
}
