package repository

// Job and HistoricJob share one schema: a HistoricJob is the persisted record of a finished Job.
_jobSchema: {
	#Action: "pull" | "push" | "pr" | "migrate" | "delete" | "deleteResources" | "releaseResources" | "move" | "fixFolderMetadata" | "test" @cuetsy(kind="enum",memberNames="Pull|Push|PullRequest|Migrate|Delete|DeleteResources|ReleaseResources|Move|FixFolderMetadata|Test")
	#State:  "pending" | "working" | "success" | "warning" | "error"
	#ResourceRef: {
		// Name is the name of the resource, such as a dashboard UID.
		name?: string
		// Kind is the type of resource, for example, "Dashboard".
		kind?: string
		// Group is the group of the resource, such as "dashboard.grafana.app".
		group?: string
	}
	#PullRequestJobOptions: {
		// The branch of commit hash
		ref?: string
		// Pull request number (when appropriate)
		pr?: int32
		// The specific commit hash that triggered this notice
		hash?: string
		// URL to the originator (eg, PR URL)
		url?: string
		// Whether the pull request's head repository differs from its base repository.
		// Omitted when repository identities were unavailable, including older jobs.
		isFork?: bool
		// URL of the head repository for a pull request from a fork, when available.
		forkURL?: string
	}
	#SyncJobOptions: {
		// Incremental synchronization for versioned repositories
		incremental: bool
	}
	#ExportJobOptions: {
		// Message to use when committing the changes in a single commit.
		// Deprecated: set JobSpec.Message instead. This field is kept for
		// backwards compatibility and is only used when JobSpec.Message is empty.
		message?: string
		// The source folder (or empty) to export
		folder?: string
		// FIXME: we should validate this in admission hooks
		// Target branch for export (only git)
		branch?: string
		// FIXME: we should validate this in admission hooks
		// Prefix in target file system
		path?: string
		// Resources to export.
		// When empty, every unmanaged resource in the namespace is exported (legacy behavior).
		// When non-empty, only the listed resources are exported — the folder hierarchy is still
		// emitted so parent paths resolve. Currently only unmanaged Dashboards are supported.
		resources?: [...#ResourceRef]
		// GenerateNewFolderIDs writes a freshly generated identifier into each exported
		// folder's metadata (_folder.json) instead of preserving the existing folder UID.
		// Use this to produce a portable export that creates new folders on a subsequent
		// sync rather than taking over the originals. Has no effect when folder metadata
		// is not written.
		generateNewFolderIDs?: bool
	}
	#MigrateJobOptions: {
		// Message to use when committing the changes in a single commit.
		// Deprecated: set JobSpec.Message instead. This field is kept for
		// backwards compatibility and is only used when JobSpec.Message is empty.
		message?: string
		// Target branch for the migration (git only). When set to a branch other than
		// the repository's configured branch, the migration writes the exported resources
		// to that branch (a pull request workflow) and removes the migrated resources from
		// the instance instead of taking ownership of them — they return as managed
		// resources once the branch is merged and a regular sync runs on the configured
		// branch. When empty (or equal to the configured branch), the migration writes
		// directly to the configured branch and takes ownership of the exported resources.
		branch?: string
		// Resources to migrate.
		// When empty, every unmanaged resource in the namespace is migrated (legacy behavior).
		// When non-empty, only the listed resources are exported to the repository — the folder
		// hierarchy is still emitted so parent paths resolve, and the subsequent pull phase only
		// takes ownership of those resources. Currently only unmanaged Dashboards are supported.
		resources?: [...#ResourceRef]
		// GenerateNewFolderIDs writes a freshly generated identifier into each exported
		// folder's metadata (_folder.json) instead of preserving the existing folder UID.
		// The subsequent pull creates new folders rather than taking over the originals.
		// Has no effect when folder metadata is not written.
		generateNewFolderIDs?: bool
		// SkipResourceDeletion keeps the migrated resources on the instance instead of
		// removing them. By default a migration deletes the resources it moved (the whole
		// namespace for an instance target, or the exported resources for a branch
		// migration); when true, no deletion happens and the resources are left in place.
		skipResourceDeletion?: bool
	}
	#DeleteJobOptions: {
		// Ref to the branch or commit hash to delete from
		ref?: string
		// Paths to be deleted. Examples:
		// - dashboard.json (for a file)
		// - a/b/c/other-dashboard.json (for a file)
		// - nested/deep/ (for a directory)
		// FIXME: we should validate this in admission hooks
		paths?: [...string]
		// Resources to delete
		// This option has been created because currently the frontend does not use
		// standarized app platform APIs. For performance and API consistency reasons, the preferred option
		// is it to use the paths.
		resources?: [...#ResourceRef]
	}
	#MoveJobOptions: {
		// Ref to the branch or commit hash that should move
		ref?: string
		// Paths to be deleted. Examples:
		// - dashboard.json (for a file)
		// - a/b/c/other-dashboard.json (for a file)
		// - nested/deep/ (for a directory)
		// FIXME: we should validate this in admission hooks
		paths?: [...string]
		// Destination path for the move (e.g. "new-location/")
		targetPath?: string
		// Resources to move
		// This option has been created because currently the frontend does not use
		// standarized app platform APIs. For performance and API consistency reasons, the preferred option
		// is it to use the paths.
		resources?: [...#ResourceRef]
	}
	#FixFolderMetadataJobOptions: {
		// Ref to the branch to create the commit on (uses repository's default branch if not specified)
		ref?: string
	}
	#TestJobOptions: {
		// Duration is how long the job should sleep before completing, expressed as a
		// Go duration string (for example "10s" or "2m"). It must be positive and is
		// capped by the server to keep a single job's runtime predictable.
		duration?: string
		// ProgressUpdates controls how many progress notifications the job emits while
		// running. A value of 0 uses the server default.
		progressUpdates?: int32
	}
	#ResourceSummary: {
		group?: string
		kind?:  string
		// The count (if known)
		total?:  int64
		create?: int64
		update?: int64
		delete?: int64
		// Create or update (export)
		write?: int64
		// The error count
		error?: int64
		// The warning count
		warning?: int64
		// No action required (useful for sync)
		noop?: int64
		// TotalChanges is the action-aware count of resources changed for this group/kind,
		// set by the progress recorder as results are recorded. Used for the job-duration
		// histogram's resources_changed bucket.
		totalChanges?: int64
		// Report errors/warnings for this resource type
		// This may not be an exhaustive list and recommend looking at the logs for more info
		errors?: [...string]
		warnings?: [...string]
	}
	#RepositoryURLs: {
		// A URL pointing to the repository this lives in
		repositoryURL?: string
		// A URL pointing to the file or ref in the repository
		sourceURL?: string
		// A URL that will create a new pull request for this branch
		newPullRequestURL?: string
		// Compare this version to the target branch
		compareURL?: string
	}
	spec: {
		action: #Action
		// The the repository reference (for now also in labels)
		// This value is required, but will be popuplated from the job making the request
		repository?: string
		// Commit message for this job. Applies to job actions that produce
		// commits (delete, move, migrate, push, fixFolderMetadata).
		// When empty, the backend falls back to the action-specific message
		// field (ExportJobOptions.Message, MigrateJobOptions.Message) for
		// backwards compatibility, then to a built-in default.
		message?: string
		// Pull request options
		pr?: #PullRequestJobOptions
		// Required when the action is `push`
		push?: #ExportJobOptions
		// Required when the action is `pull`
		pull?: #SyncJobOptions
		// Required when the action is `migrate`
		migrate?: #MigrateJobOptions
		// Delete when the action is `delete`
		delete?: #DeleteJobOptions
		// Move when the action is `move`
		move?: #MoveJobOptions
		// Options when the action is `fix-folder-metadata`
		fixFolderMetadata?: #FixFolderMetadataJobOptions
		// Required when the action is `test`
		test?: #TestJobOptions
	}
	status: {
		state?:    #State
		started?:  int64
		finished?: int64
		message?:  string
		errors?: [...string]
		warnings?: [...string]
		// Optional value 0-100 that can be set while running
		progress?: float64
		// ProgressUpdates is the number of times the job's status has been written
		// while it was processed. It is carried over to the historic job so the total
		// number of progress updates a job went through remains observable after completion.
		progressUpdates?: int64
		// Summary of processed actions
		summary?: [...#ResourceSummary]
		// URLs contains URLs for the reference branch or commit if applicable.
		url?: #RepositoryURLs
	}
}

job: {
	kind:       "Job"
	pluralName: "Jobs"
	validation: operations: ["CREATE", "UPDATE"]
	mutation: operations: ["CREATE"]
	schema: _jobSchema
}

historicJob: {
	kind:       "HistoricJob"
	pluralName: "HistoricJobs"
	validation: operations: ["CREATE", "UPDATE"]
	schema: _jobSchema
}
