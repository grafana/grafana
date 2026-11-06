package v0alpha1

// +enum
type JobAction string

func (JobAction) OpenAPIModelName() string {
	return OpenAPIPrefix + "JobAction"
}

const (
	// JobActionPull replicates the remote branch in the local copy of the repository.
	JobActionPull JobAction = "pull"

	// JobActionPush replicates the local copy of the repository in the remote branch.
	JobActionPush JobAction = "push"

	// JobActionPullRequest adds additional useful information to a PR, such as comments with preview links and rendered images.
	JobActionPullRequest JobAction = "pr"

	// JobActionMigrate acts like JobActionExport, then JobActionPull. It also tries to preserve the history.
	JobActionMigrate JobAction = "migrate"

	// JobActionDelete deletes files in the remote repository
	JobActionDelete JobAction = "delete"

	// JobActionMove moves files in the remote repository
	JobActionMove JobAction = "move"

	// JobActionFixFolderMetadata is a placeholder job that will eventually regenerate folder metadata files.
	// Currently a no-op to unblock frontend development.
	JobActionFixFolderMetadata JobAction = "fixFolderMetadata"

	// JobActionReleaseResources removes ownership annotations from all resources
	// managed by a repository that no longer exists or is stuck in Terminating state.
	// Resources remain in Grafana but become unmanaged.
	// This action has inverted validation: it is only allowed when the repository
	// does not exist or has a DeletionTimestamp set.
	JobActionReleaseResources JobAction = "releaseResources"

	// JobActionDeleteResources deletes all resources managed by a repository
	// that no longer exists or is stuck in Terminating state.
	// This action has inverted validation: it is only allowed when the repository
	// does not exist or has a DeletionTimestamp set.
	JobActionDeleteResources JobAction = "deleteResources"

	// JobActionTest is a synthetic job that does no real work: it simply sleeps
	// for a configurable duration and then completes successfully. It exists only
	// to generate controlled load on the job queue and controllers for
	// performance testing, and is gated behind the provisioning.performance
	// feature flag.
	JobActionTest JobAction = "test"
)

// +enum
type JobState string

const (
	// Job has been submitted, but not processed yet
	JobStatePending JobState = "pending"

	// The job is running
	JobStateWorking JobState = "working"

	// Finished with success
	JobStateSuccess JobState = "success"

	// Finished with errors
	JobStateError JobState = "error"

	// Finished with some non-critical errors
	JobStateWarning JobState = "warning"
)

func (j JobState) Finished() bool {
	return j == JobStateSuccess || j == JobStateError || j == JobStateWarning
}

// ToSyncStatus converts a job status to a sync status, which will be put in the repository status.
func (in JobStatus) ToSyncStatus(jobId string) SyncStatus {
	s := SyncStatus{
		JobID:    jobId,
		State:    in.State,
		Started:  in.Started,
		Finished: in.Finished,
	}

	if len(in.Errors) > 0 {
		s.Message = in.Errors
	} else if len(in.Warnings) > 0 {
		s.Message = in.Warnings
	} else if in.State == JobStateError && in.Message != "" {
		s.Message = []string{in.Message}
	}

	return s
}
