package v0alpha1

import (
	"encoding/json"

	"k8s.io/utils/ptr"
)

func (j JobState) Finished() bool {
	return j == JobStateSuccess || j == JobStateError || j == JobStateWarning
}

// ToSyncStatus converts a job status to a sync status, which will be put in the repository status.
func (in JobStatus) ToSyncStatus(jobId string) RepositorySyncStatus {
	s := RepositorySyncStatus{
		Job:      new(jobId),
		State:    RepositoryJobState(ptr.Deref(in.State, "")),
		Started:  in.Started,
		Finished: in.Finished,
	}

	if len(in.Errors) > 0 {
		s.Message = in.Errors
	} else if len(in.Warnings) > 0 {
		s.Message = in.Warnings
	} else if ptr.Deref(in.State, "") == JobStateError && ptr.Deref(in.Message, "") != "" {
		s.Message = []string{ptr.Deref(in.Message, "")}
	}

	return s
}

// ToHistoric converts a job spec to its HistoricJob copy. Both are generated from the same
// CUE definition into distinct Go types, so they share a JSON encoding.
func (in JobSpec) ToHistoric() (HistoricJobSpec, error) {
	return convertJSON[HistoricJobSpec](in)
}

// ToHistoric converts a job status to its HistoricJob copy.
func (in JobStatus) ToHistoric() (HistoricJobStatus, error) {
	return convertJSON[HistoricJobStatus](in)
}

// ToJob converts a historic job spec back to a job spec.
func (in HistoricJobSpec) ToJob() (JobSpec, error) {
	return convertJSON[JobSpec](in)
}

// ToJob converts a historic job status back to a job status.
func (in HistoricJobStatus) ToJob() (JobStatus, error) {
	return convertJSON[JobStatus](in)
}

func convertJSON[Out any](in any) (Out, error) {
	var out Out
	data, err := json.Marshal(in)
	if err != nil {
		return out, err
	}
	err = json.Unmarshal(data, &out)
	return out, err
}
