// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type JobPullRequestJobOptions struct {
	// The branch of commit hash
	Ref *string `json:"ref,omitempty"`
	// Pull request number (when appropriate)
	Pr *int64 `json:"pr,omitempty"`
	// The specific commit hash that triggered this notice
	Hash *string `json:"hash,omitempty"`
	// URL to the originator (eg, PR URL)
	Url *string `json:"url,omitempty"`
	// Whether the pull request's head repository differs from its base repository.
	// Omitted when repository identities were unavailable, including older jobs.
	IsFork *bool `json:"isFork,omitempty"`
	// URL of the head repository for a pull request from a fork, when available.
	ForkURL *string `json:"forkURL,omitempty"`
}

// NewJobPullRequestJobOptions creates a new JobPullRequestJobOptions object.
func NewJobPullRequestJobOptions() *JobPullRequestJobOptions {
	return &JobPullRequestJobOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for JobPullRequestJobOptions.
func (JobPullRequestJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobPullRequestJobOptions"
}

// +k8s:openapi-gen=true
type JobExportJobOptions struct {
	// Message to use when committing the changes in a single commit.
	// Deprecated: set JobSpec.Message instead. This field is kept for
	// backwards compatibility and is only used when JobSpec.Message is empty.
	Message *string `json:"message,omitempty"`
	// The source folder (or empty) to export
	Folder *string `json:"folder,omitempty"`
	// Target branch for export (only git)
	Branch *string `json:"branch,omitempty"`
	// Prefix in target file system
	Path *string `json:"path,omitempty"`
	// Resources to export. When empty, every unmanaged resource in the namespace
	// is exported (legacy behavior). When non-empty, only the listed resources
	// are exported — the folder hierarchy is still emitted so parent paths resolve.
	// Currently only unmanaged Dashboards are supported.
	Resources []JobResourceRef `json:"resources,omitempty"`
	// GenerateNewFolderIDs writes a freshly generated identifier into each
	// exported folder's metadata (_folder.json) instead of preserving the
	// existing folder UID. Use this to produce a portable export that creates
	// new folders on a subsequent sync rather than taking over the originals.
	// Has no effect when folder metadata is not written.
	GenerateNewFolderIDs *bool `json:"generateNewFolderIDs,omitempty"`
}

// NewJobExportJobOptions creates a new JobExportJobOptions object.
func NewJobExportJobOptions() *JobExportJobOptions {
	return &JobExportJobOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for JobExportJobOptions.
func (JobExportJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobExportJobOptions"
}

// +k8s:openapi-gen=true
type JobResourceRef struct {
	// Name is the name of the resource, such as a dashboard UID.
	Name *string `json:"name,omitempty"`
	// Kind is the type of resource, for example, "Dashboard".
	Kind *string `json:"kind,omitempty"`
	// Group is the group of the resource, such as "dashboard.grafana.app".
	Group *string `json:"group,omitempty"`
}

// NewJobResourceRef creates a new JobResourceRef object.
func NewJobResourceRef() *JobResourceRef {
	return &JobResourceRef{}
}

// OpenAPIModelName returns the OpenAPI model name for JobResourceRef.
func (JobResourceRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobResourceRef"
}

// +k8s:openapi-gen=true
type JobSyncJobOptions struct {
	// Incremental synchronization for versioned repositories
	Incremental bool `json:"incremental"`
}

// NewJobSyncJobOptions creates a new JobSyncJobOptions object.
func NewJobSyncJobOptions() *JobSyncJobOptions {
	return &JobSyncJobOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for JobSyncJobOptions.
func (JobSyncJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobSyncJobOptions"
}

// +k8s:openapi-gen=true
type JobMigrateJobOptions struct {
	// Message to use when committing the changes in a single commit.
	// Deprecated: set JobSpec.Message instead. This field is kept for
	// backwards compatibility and is only used when JobSpec.Message is empty.
	Message *string `json:"message,omitempty"`
	// Target branch for the migration (git only). When set to a branch other
	// than the repository's configured branch, the migration writes the exported
	// resources to that branch (a pull request workflow) and removes the migrated
	// resources from the instance instead of taking ownership of them — they
	// return as managed resources once the branch is merged and a regular sync
	// runs on the configured branch. When empty (or equal to the configured
	// branch), the migration writes directly to the configured branch and takes
	// ownership of the exported resources.
	Branch *string `json:"branch,omitempty"`
	// Resources to migrate. When empty, every unmanaged resource in the namespace
	// is migrated (legacy behavior). When non-empty, only the listed resources
	// are exported to the repository — the folder hierarchy is still emitted so
	// parent paths resolve, and the subsequent pull phase only takes ownership
	// of those resources.
	// Currently only unmanaged Dashboards are supported.
	Resources []JobResourceRef `json:"resources,omitempty"`
	// GenerateNewFolderIDs writes a freshly generated identifier into each
	// exported folder's metadata (_folder.json) instead of preserving the
	// existing folder UID. The subsequent pull creates new folders rather than
	// taking over the originals. Has no effect when folder metadata is not written.
	GenerateNewFolderIDs *bool `json:"generateNewFolderIDs,omitempty"`
	// SkipResourceDeletion keeps the migrated resources on the instance instead of
	// removing them. By default a migration deletes the resources it moved (the
	// whole namespace for an instance target, or the exported resources for a
	// branch migration); when true, no deletion happens and the resources are
	// left in place.
	SkipResourceDeletion *bool `json:"skipResourceDeletion,omitempty"`
}

// NewJobMigrateJobOptions creates a new JobMigrateJobOptions object.
func NewJobMigrateJobOptions() *JobMigrateJobOptions {
	return &JobMigrateJobOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for JobMigrateJobOptions.
func (JobMigrateJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobMigrateJobOptions"
}

// +k8s:openapi-gen=true
type JobDeleteJobOptions struct {
	// Ref to the branch or commit hash to delete from
	Ref *string `json:"ref,omitempty"`
	// Paths to be deleted. Examples:
	// - dashboard.json (for a file)
	// - a/b/c/other-dashboard.json (for a file)
	// - nested/deep/ (for a directory)
	Paths []string `json:"paths,omitempty"`
	// Resources to delete
	// This option has been created because currently the frontend does not use
	// standarized app platform APIs. For performance and API consistency reasons, the preferred option
	// is it to use the paths.
	Resources []JobResourceRef `json:"resources,omitempty"`
}

// NewJobDeleteJobOptions creates a new JobDeleteJobOptions object.
func NewJobDeleteJobOptions() *JobDeleteJobOptions {
	return &JobDeleteJobOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for JobDeleteJobOptions.
func (JobDeleteJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobDeleteJobOptions"
}

// +k8s:openapi-gen=true
type JobMoveJobOptions struct {
	// Ref to the branch or commit hash that should move
	Ref *string `json:"ref,omitempty"`
	// Paths to be deleted. Examples:
	// - dashboard.json (for a file)
	// - a/b/c/other-dashboard.json (for a file)
	// - nested/deep/ (for a directory)
	Paths []string `json:"paths,omitempty"`
	// Destination path for the move (e.g. "new-location/")
	TargetPath *string `json:"targetPath,omitempty"`
	// Resources to move
	// This option has been created because currently the frontend does not use
	// standarized app platform APIs. For performance and API consistency reasons, the preferred option
	// is it to use the paths.
	Resources []JobResourceRef `json:"resources,omitempty"`
}

// NewJobMoveJobOptions creates a new JobMoveJobOptions object.
func NewJobMoveJobOptions() *JobMoveJobOptions {
	return &JobMoveJobOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for JobMoveJobOptions.
func (JobMoveJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobMoveJobOptions"
}

// +k8s:openapi-gen=true
type JobFixFolderMetadataJobOptions struct {
	// Ref to the branch to create the commit on (uses repository's default branch if not specified)
	Ref *string `json:"ref,omitempty"`
}

// NewJobFixFolderMetadataJobOptions creates a new JobFixFolderMetadataJobOptions object.
func NewJobFixFolderMetadataJobOptions() *JobFixFolderMetadataJobOptions {
	return &JobFixFolderMetadataJobOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for JobFixFolderMetadataJobOptions.
func (JobFixFolderMetadataJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobFixFolderMetadataJobOptions"
}

// TestJobOptions configures a synthetic performance-testing job. The job does
// no real work; it sleeps for Duration and then completes. It is only usable
// when the provisioning.performance feature flag is enabled.
// +k8s:openapi-gen=true
type JobTestJobOptions struct {
	// Duration is how long the job should sleep before completing, expressed as
	// a Go duration string (for example "10s" or "2m"). It must be positive and
	// is capped by the server to keep a single job's runtime predictable.
	Duration *string `json:"duration,omitempty"`
	// ProgressUpdates controls how many progress notifications the job emits
	// while running. A value of 0 uses the server default.
	ProgressUpdates *int64 `json:"progressUpdates,omitempty"`
}

// NewJobTestJobOptions creates a new JobTestJobOptions object.
func NewJobTestJobOptions() *JobTestJobOptions {
	return &JobTestJobOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for JobTestJobOptions.
func (JobTestJobOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobTestJobOptions"
}

// +k8s:openapi-gen=true
type JobSpec struct {
	Action JobSpecAction `json:"action"`
	// The the repository reference (for now also in labels)
	// This value is required, but will be popuplated from the job making the request
	Repository *string `json:"repository,omitempty"`
	// Commit message for this job. Applies to job actions that produce
	// commits (delete, move, migrate, push, fixFolderMetadata).
	// When empty, the backend falls back to the action-specific message
	// field (ExportJobOptions.Message, MigrateJobOptions.Message) for
	// backwards compatibility, then to a built-in default.
	Message *string `json:"message,omitempty"`
	// Pull request options
	Pr *JobPullRequestJobOptions `json:"pr,omitempty"`
	// Required when the action is `push`
	Push *JobExportJobOptions `json:"push,omitempty"`
	// Required when the action is `pull`
	Pull *JobSyncJobOptions `json:"pull,omitempty"`
	// Required when the action is `migrate`
	Migrate *JobMigrateJobOptions `json:"migrate,omitempty"`
	// Delete when the action is `delete`
	Delete *JobDeleteJobOptions `json:"delete,omitempty"`
	// Move when the action is `move`
	Move *JobMoveJobOptions `json:"move,omitempty"`
	// Options when the action is `fix-folder-metadata`
	FixFolderMetadata *JobFixFolderMetadataJobOptions `json:"fixFolderMetadata,omitempty"`
	// Required when the action is `test`
	Test *JobTestJobOptions `json:"test,omitempty"`
}

// NewJobSpec creates a new JobSpec object.
func NewJobSpec() *JobSpec {
	return &JobSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for JobSpec.
func (JobSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobSpec"
}

// +k8s:openapi-gen=true
type JobSpecAction string

const (
	JobSpecActionPull              JobSpecAction = "pull"
	JobSpecActionPush              JobSpecAction = "push"
	JobSpecActionPr                JobSpecAction = "pr"
	JobSpecActionMigrate           JobSpecAction = "migrate"
	JobSpecActionDelete            JobSpecAction = "delete"
	JobSpecActionMove              JobSpecAction = "move"
	JobSpecActionFixFolderMetadata JobSpecAction = "fixFolderMetadata"
	JobSpecActionReleaseResources  JobSpecAction = "releaseResources"
	JobSpecActionDeleteResources   JobSpecAction = "deleteResources"
	JobSpecActionTest              JobSpecAction = "test"
)

// OpenAPIModelName returns the OpenAPI model name for JobSpecAction.
func (JobSpecAction) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.JobSpecAction"
}
