package v1beta2

import (
	"fmt"
	"math"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// RegisterJobConversions registers Job, HistoricJob, their lists and JobSpec conversions
// between v0alpha1 and v1beta2 in both directions.
func RegisterJobConversions(s *runtime.Scheme) error {
	conversions := []struct {
		a, b any
		fn   conversion.ConversionFunc
	}{
		{(*v0alpha1.Job)(nil), (*Job)(nil), func(a, b any, scope conversion.Scope) error {
			return Convert_v0alpha1_Job_To_v1beta2_Job(a.(*v0alpha1.Job), b.(*Job), scope)
		}},
		{(*Job)(nil), (*v0alpha1.Job)(nil), func(a, b any, scope conversion.Scope) error {
			return Convert_v1beta2_Job_To_v0alpha1_Job(a.(*Job), b.(*v0alpha1.Job), scope)
		}},
		{(*v0alpha1.JobList)(nil), (*JobList)(nil), func(a, b any, scope conversion.Scope) error {
			return Convert_v0alpha1_JobList_To_v1beta2_JobList(a.(*v0alpha1.JobList), b.(*JobList), scope)
		}},
		{(*JobList)(nil), (*v0alpha1.JobList)(nil), func(a, b any, scope conversion.Scope) error {
			return Convert_v1beta2_JobList_To_v0alpha1_JobList(a.(*JobList), b.(*v0alpha1.JobList), scope)
		}},
		{(*v0alpha1.JobSpec)(nil), (*JobSpec)(nil), func(a, b any, scope conversion.Scope) error {
			return Convert_v0alpha1_JobSpec_To_v1beta2_JobSpec(a.(*v0alpha1.JobSpec), b.(*JobSpec), scope)
		}},
		{(*JobSpec)(nil), (*v0alpha1.JobSpec)(nil), func(a, b any, scope conversion.Scope) error {
			return Convert_v1beta2_JobSpec_To_v0alpha1_JobSpec(a.(*JobSpec), b.(*v0alpha1.JobSpec), scope)
		}},
		{(*v0alpha1.HistoricJob)(nil), (*HistoricJob)(nil), func(a, b any, scope conversion.Scope) error {
			return Convert_v0alpha1_HistoricJob_To_v1beta2_HistoricJob(a.(*v0alpha1.HistoricJob), b.(*HistoricJob), scope)
		}},
		{(*HistoricJob)(nil), (*v0alpha1.HistoricJob)(nil), func(a, b any, scope conversion.Scope) error {
			return Convert_v1beta2_HistoricJob_To_v0alpha1_HistoricJob(a.(*HistoricJob), b.(*v0alpha1.HistoricJob), scope)
		}},
		{(*v0alpha1.HistoricJobList)(nil), (*HistoricJobList)(nil), func(a, b any, scope conversion.Scope) error {
			return Convert_v0alpha1_HistoricJobList_To_v1beta2_HistoricJobList(a.(*v0alpha1.HistoricJobList), b.(*HistoricJobList), scope)
		}},
		{(*HistoricJobList)(nil), (*v0alpha1.HistoricJobList)(nil), func(a, b any, scope conversion.Scope) error {
			return Convert_v1beta2_HistoricJobList_To_v0alpha1_HistoricJobList(a.(*HistoricJobList), b.(*v0alpha1.HistoricJobList), scope)
		}},
	}
	for _, c := range conversions {
		if err := s.AddConversionFunc(c.a, c.b, c.fn); err != nil {
			return err
		}
	}
	return nil
}

// TypeMeta is left to the codec: conversions only map metadata, spec and status.

func Convert_v0alpha1_Job_To_v1beta2_Job(in *v0alpha1.Job, out *Job, s conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	if err := Convert_v0alpha1_JobSpec_To_v1beta2_JobSpec(&in.Spec, &out.Spec, s); err != nil {
		return err
	}
	out.Status = jobStatusToV1beta2(in.Status)
	return nil
}

func Convert_v1beta2_Job_To_v0alpha1_Job(in *Job, out *v0alpha1.Job, s conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	if err := Convert_v1beta2_JobSpec_To_v0alpha1_JobSpec(&in.Spec, &out.Spec, s); err != nil {
		return err
	}
	out.Status = jobStatusFromV1beta2(in.Status)
	return nil
}

func Convert_v0alpha1_JobList_To_v1beta2_JobList(in *v0alpha1.JobList, out *JobList, s conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = nil
	if in.Items != nil {
		out.Items = make([]Job, len(in.Items))
	}
	for i := range in.Items {
		if err := Convert_v0alpha1_Job_To_v1beta2_Job(&in.Items[i], &out.Items[i], s); err != nil {
			return fmt.Errorf("items[%d]: %w", i, err)
		}
	}
	return nil
}

func Convert_v1beta2_JobList_To_v0alpha1_JobList(in *JobList, out *v0alpha1.JobList, s conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = nil
	if in.Items != nil {
		out.Items = make([]v0alpha1.Job, len(in.Items))
	}
	for i := range in.Items {
		if err := Convert_v1beta2_Job_To_v0alpha1_Job(&in.Items[i], &out.Items[i], s); err != nil {
			return fmt.Errorf("items[%d]: %w", i, err)
		}
	}
	return nil
}

func Convert_v0alpha1_JobSpec_To_v1beta2_JobSpec(in *v0alpha1.JobSpec, out *JobSpec, _ conversion.Scope) error {
	*out = JobSpec{
		Action:     JobAction(in.Action),
		Repository: jobNonZero(in.Repository),
		Message:    jobNonZero(in.Message),
	}
	if in.PullRequest != nil {
		pr, err := jobInt32("spec.pr.pr", in.PullRequest.PR)
		if err != nil {
			return err
		}
		out.Pr = &JobPullRequestJobOptions{
			Ref:     jobNonZero(in.PullRequest.Ref),
			Pr:      pr,
			Hash:    jobNonZero(in.PullRequest.Hash),
			Url:     jobNonZero(in.PullRequest.URL),
			IsFork:  in.PullRequest.IsFork,
			ForkURL: jobNonZero(in.PullRequest.ForkURL),
		}
	}
	if in.Push != nil {
		out.Push = &JobExportJobOptions{
			Message:              jobNonZero(in.Push.Message),
			Folder:               jobNonZero(in.Push.Folder),
			Branch:               jobNonZero(in.Push.Branch),
			Path:                 jobNonZero(in.Push.Path),
			Resources:            jobResourceRefsToV1beta2(in.Push.Resources),
			GenerateNewFolderIDs: jobNonZero(in.Push.GenerateNewFolderIDs),
		}
	}
	if in.Pull != nil {
		out.Pull = &JobSyncJobOptions{Incremental: in.Pull.Incremental}
	}
	if in.Migrate != nil {
		out.Migrate = &JobMigrateJobOptions{
			Message:              jobNonZero(in.Migrate.Message),
			Branch:               jobNonZero(in.Migrate.Branch),
			Resources:            jobResourceRefsToV1beta2(in.Migrate.Resources),
			GenerateNewFolderIDs: jobNonZero(in.Migrate.GenerateNewFolderIDs),
			SkipResourceDeletion: jobNonZero(in.Migrate.SkipResourceDeletion),
		}
	}
	if in.Delete != nil {
		out.Delete = &JobDeleteJobOptions{
			Ref:       jobNonZero(in.Delete.Ref),
			Paths:     in.Delete.Paths,
			Resources: jobResourceRefsToV1beta2(in.Delete.Resources),
		}
	}
	if in.Move != nil {
		out.Move = &JobMoveJobOptions{
			Ref:        jobNonZero(in.Move.Ref),
			Paths:      in.Move.Paths,
			TargetPath: jobNonZero(in.Move.TargetPath),
			Resources:  jobResourceRefsToV1beta2(in.Move.Resources),
		}
	}
	if in.FixFolderMetadata != nil {
		out.FixFolderMetadata = &JobFixFolderMetadataJobOptions{Ref: jobNonZero(in.FixFolderMetadata.Ref)}
	}
	if in.Test != nil {
		progressUpdates, err := jobInt32("spec.test.progressUpdates", in.Test.ProgressUpdates)
		if err != nil {
			return err
		}
		out.Test = &JobTestJobOptions{
			Duration:        jobDurationToString(in.Test.Duration),
			ProgressUpdates: progressUpdates,
		}
	}
	return nil
}

func Convert_v1beta2_JobSpec_To_v0alpha1_JobSpec(in *JobSpec, out *v0alpha1.JobSpec, _ conversion.Scope) error {
	*out = v0alpha1.JobSpec{
		Action:     v0alpha1.JobAction(in.Action),
		Repository: jobValue(in.Repository),
		Message:    jobValue(in.Message),
	}
	if in.Pr != nil {
		out.PullRequest = &v0alpha1.PullRequestJobOptions{
			Ref:     jobValue(in.Pr.Ref),
			PR:      int(jobValue(in.Pr.Pr)),
			Hash:    jobValue(in.Pr.Hash),
			URL:     jobValue(in.Pr.Url),
			IsFork:  in.Pr.IsFork,
			ForkURL: jobValue(in.Pr.ForkURL),
		}
	}
	if in.Push != nil {
		out.Push = &v0alpha1.ExportJobOptions{
			Message:              jobValue(in.Push.Message),
			Folder:               jobValue(in.Push.Folder),
			Branch:               jobValue(in.Push.Branch),
			Path:                 jobValue(in.Push.Path),
			Resources:            jobResourceRefsFromV1beta2(in.Push.Resources),
			GenerateNewFolderIDs: jobValue(in.Push.GenerateNewFolderIDs),
		}
	}
	if in.Pull != nil {
		out.Pull = &v0alpha1.SyncJobOptions{Incremental: in.Pull.Incremental}
	}
	if in.Migrate != nil {
		out.Migrate = &v0alpha1.MigrateJobOptions{
			Message:              jobValue(in.Migrate.Message),
			Branch:               jobValue(in.Migrate.Branch),
			Resources:            jobResourceRefsFromV1beta2(in.Migrate.Resources),
			GenerateNewFolderIDs: jobValue(in.Migrate.GenerateNewFolderIDs),
			SkipResourceDeletion: jobValue(in.Migrate.SkipResourceDeletion),
		}
	}
	if in.Delete != nil {
		out.Delete = &v0alpha1.DeleteJobOptions{
			Ref:       jobValue(in.Delete.Ref),
			Paths:     in.Delete.Paths,
			Resources: jobResourceRefsFromV1beta2(in.Delete.Resources),
		}
	}
	if in.Move != nil {
		out.Move = &v0alpha1.MoveJobOptions{
			Ref:        jobValue(in.Move.Ref),
			Paths:      in.Move.Paths,
			TargetPath: jobValue(in.Move.TargetPath),
			Resources:  jobResourceRefsFromV1beta2(in.Move.Resources),
		}
	}
	if in.FixFolderMetadata != nil {
		out.FixFolderMetadata = &v0alpha1.FixFolderMetadataJobOptions{Ref: jobValue(in.FixFolderMetadata.Ref)}
	}
	if in.Test != nil {
		duration, err := jobDurationFromString("spec.test.duration", in.Test.Duration)
		if err != nil {
			return err
		}
		out.Test = &v0alpha1.TestJobOptions{
			Duration:        duration,
			ProgressUpdates: int(jobValue(in.Test.ProgressUpdates)),
		}
	}
	return nil
}

func jobResourceRefsToV1beta2(in []v0alpha1.ResourceRef) []JobResourceRef {
	if in == nil {
		return nil
	}
	out := make([]JobResourceRef, len(in))
	for i, r := range in {
		out[i] = JobResourceRef{Name: jobNonZero(r.Name), Kind: jobNonZero(r.Kind), Group: jobNonZero(r.Group)}
	}
	return out
}

func jobResourceRefsFromV1beta2(in []JobResourceRef) []v0alpha1.ResourceRef {
	if in == nil {
		return nil
	}
	out := make([]v0alpha1.ResourceRef, len(in))
	for i, r := range in {
		out[i] = v0alpha1.ResourceRef{Name: jobValue(r.Name), Kind: jobValue(r.Kind), Group: jobValue(r.Group)}
	}
	return out
}

func jobStatusToV1beta2(in v0alpha1.JobStatus) JobStatus {
	out := JobStatus{
		State:           jobNonZero(JobState(in.State)),
		Started:         jobNonZero(in.Started),
		Finished:        jobNonZero(in.Finished),
		Message:         jobNonZero(in.Message),
		Errors:          in.Errors,
		Warnings:        in.Warnings,
		Progress:        jobNonZero(in.Progress),
		ProgressUpdates: jobNonZero(in.ProgressUpdates),
	}
	if in.Summary != nil {
		out.Summary = make([]JobResourceSummary, len(in.Summary))
		for i, sum := range in.Summary {
			// v1beta2 has no nil entries; a nil v0alpha1 entry becomes an empty summary.
			if sum != nil {
				out.Summary[i] = jobResourceSummaryToV1beta2(*sum)
			}
		}
	}
	if in.URLs != nil {
		out.Url = &JobRepositoryURLs{
			RepositoryURL:     jobNonZero(in.URLs.RepositoryURL),
			SourceURL:         jobNonZero(in.URLs.SourceURL),
			NewPullRequestURL: jobNonZero(in.URLs.NewPullRequestURL),
			CompareURL:        jobNonZero(in.URLs.CompareURL),
		}
	}
	return out
}

func jobStatusFromV1beta2(in JobStatus) v0alpha1.JobStatus {
	out := v0alpha1.JobStatus{
		State:           v0alpha1.JobState(jobValue(in.State)),
		Started:         jobValue(in.Started),
		Finished:        jobValue(in.Finished),
		Message:         jobValue(in.Message),
		Errors:          in.Errors,
		Warnings:        in.Warnings,
		Progress:        jobValue(in.Progress),
		ProgressUpdates: jobValue(in.ProgressUpdates),
	}
	if in.Summary != nil {
		out.Summary = make([]*v0alpha1.JobResourceSummary, len(in.Summary))
		for i := range in.Summary {
			sum := jobResourceSummaryFromV1beta2(in.Summary[i])
			out.Summary[i] = &sum
		}
	}
	if in.Url != nil {
		out.URLs = &v0alpha1.RepositoryURLs{
			RepositoryURL:     jobValue(in.Url.RepositoryURL),
			SourceURL:         jobValue(in.Url.SourceURL),
			NewPullRequestURL: jobValue(in.Url.NewPullRequestURL),
			CompareURL:        jobValue(in.Url.CompareURL),
		}
	}
	return out
}

func jobResourceSummaryToV1beta2(in v0alpha1.JobResourceSummary) JobResourceSummary {
	return JobResourceSummary{
		Group:        jobNonZero(in.Group),
		Kind:         jobNonZero(in.Kind),
		Total:        jobNonZero(in.Total),
		Create:       jobNonZero(in.Create),
		Update:       jobNonZero(in.Update),
		Delete:       jobNonZero(in.Delete),
		Write:        jobNonZero(in.Write),
		Error:        jobNonZero(in.Error),
		Warning:      jobNonZero(in.Warning),
		Noop:         jobNonZero(in.Noop),
		TotalChanges: jobNonZero(in.TotalChanges),
		Errors:       in.Errors,
		Warnings:     in.Warnings,
	}
}

func jobResourceSummaryFromV1beta2(in JobResourceSummary) v0alpha1.JobResourceSummary {
	return v0alpha1.JobResourceSummary{
		Group:        jobValue(in.Group),
		Kind:         jobValue(in.Kind),
		Total:        jobValue(in.Total),
		Create:       jobValue(in.Create),
		Update:       jobValue(in.Update),
		Delete:       jobValue(in.Delete),
		Write:        jobValue(in.Write),
		Error:        jobValue(in.Error),
		Warning:      jobValue(in.Warning),
		Noop:         jobValue(in.Noop),
		TotalChanges: jobValue(in.TotalChanges),
		Errors:       in.Errors,
		Warnings:     in.Warnings,
	}
}

// HistoricJob has its own generated v1beta2 types with the same shape as Job,
// so it converts through the Job converters.

func Convert_v0alpha1_HistoricJob_To_v1beta2_HistoricJob(in *v0alpha1.HistoricJob, out *HistoricJob, s conversion.Scope) error {
	job := &Job{}
	if err := Convert_v0alpha1_Job_To_v1beta2_Job((*v0alpha1.Job)(in), job, s); err != nil {
		return err
	}
	out.ObjectMeta = job.ObjectMeta
	out.Spec = historicJobSpecFromJobSpec(job.Spec)
	out.Status = historicJobStatusFromJobStatus(job.Status)
	return nil
}

func Convert_v1beta2_HistoricJob_To_v0alpha1_HistoricJob(in *HistoricJob, out *v0alpha1.HistoricJob, s conversion.Scope) error {
	job := &Job{
		ObjectMeta: in.ObjectMeta,
		Spec:       historicJobSpecToJobSpec(in.Spec),
		Status:     historicJobStatusToJobStatus(in.Status),
	}
	return Convert_v1beta2_Job_To_v0alpha1_Job(job, (*v0alpha1.Job)(out), s)
}

func Convert_v0alpha1_HistoricJobList_To_v1beta2_HistoricJobList(in *v0alpha1.HistoricJobList, out *HistoricJobList, s conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = nil
	if in.Items != nil {
		out.Items = make([]HistoricJob, len(in.Items))
	}
	for i := range in.Items {
		if err := Convert_v0alpha1_HistoricJob_To_v1beta2_HistoricJob(&in.Items[i], &out.Items[i], s); err != nil {
			return fmt.Errorf("items[%d]: %w", i, err)
		}
	}
	return nil
}

func Convert_v1beta2_HistoricJobList_To_v0alpha1_HistoricJobList(in *HistoricJobList, out *v0alpha1.HistoricJobList, s conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = nil
	if in.Items != nil {
		out.Items = make([]v0alpha1.HistoricJob, len(in.Items))
	}
	for i := range in.Items {
		if err := Convert_v1beta2_HistoricJob_To_v0alpha1_HistoricJob(&in.Items[i], &out.Items[i], s); err != nil {
			return fmt.Errorf("items[%d]: %w", i, err)
		}
	}
	return nil
}

func historicJobSpecFromJobSpec(in JobSpec) HistoricJobSpec {
	out := HistoricJobSpec{
		Action:     HistoricJobAction(in.Action),
		Repository: in.Repository,
		Message:    in.Message,
	}
	if in.Pr != nil {
		out.Pr = (*HistoricJobPullRequestJobOptions)(in.Pr)
	}
	if in.Push != nil {
		out.Push = &HistoricJobExportJobOptions{
			Message:              in.Push.Message,
			Folder:               in.Push.Folder,
			Branch:               in.Push.Branch,
			Path:                 in.Push.Path,
			Resources:            jobConvertSlice(in.Push.Resources, func(r JobResourceRef) HistoricJobResourceRef { return HistoricJobResourceRef(r) }),
			GenerateNewFolderIDs: in.Push.GenerateNewFolderIDs,
		}
	}
	if in.Pull != nil {
		out.Pull = (*HistoricJobSyncJobOptions)(in.Pull)
	}
	if in.Migrate != nil {
		out.Migrate = &HistoricJobMigrateJobOptions{
			Message:              in.Migrate.Message,
			Branch:               in.Migrate.Branch,
			Resources:            jobConvertSlice(in.Migrate.Resources, func(r JobResourceRef) HistoricJobResourceRef { return HistoricJobResourceRef(r) }),
			GenerateNewFolderIDs: in.Migrate.GenerateNewFolderIDs,
			SkipResourceDeletion: in.Migrate.SkipResourceDeletion,
		}
	}
	if in.Delete != nil {
		out.Delete = &HistoricJobDeleteJobOptions{
			Ref:       in.Delete.Ref,
			Paths:     in.Delete.Paths,
			Resources: jobConvertSlice(in.Delete.Resources, func(r JobResourceRef) HistoricJobResourceRef { return HistoricJobResourceRef(r) }),
		}
	}
	if in.Move != nil {
		out.Move = &HistoricJobMoveJobOptions{
			Ref:        in.Move.Ref,
			Paths:      in.Move.Paths,
			TargetPath: in.Move.TargetPath,
			Resources:  jobConvertSlice(in.Move.Resources, func(r JobResourceRef) HistoricJobResourceRef { return HistoricJobResourceRef(r) }),
		}
	}
	if in.FixFolderMetadata != nil {
		out.FixFolderMetadata = (*HistoricJobFixFolderMetadataJobOptions)(in.FixFolderMetadata)
	}
	if in.Test != nil {
		out.Test = (*HistoricJobTestJobOptions)(in.Test)
	}
	return out
}

func historicJobSpecToJobSpec(in HistoricJobSpec) JobSpec {
	out := JobSpec{
		Action:     JobAction(in.Action),
		Repository: in.Repository,
		Message:    in.Message,
	}
	if in.Pr != nil {
		out.Pr = (*JobPullRequestJobOptions)(in.Pr)
	}
	if in.Push != nil {
		out.Push = &JobExportJobOptions{
			Message:              in.Push.Message,
			Folder:               in.Push.Folder,
			Branch:               in.Push.Branch,
			Path:                 in.Push.Path,
			Resources:            jobConvertSlice(in.Push.Resources, func(r HistoricJobResourceRef) JobResourceRef { return JobResourceRef(r) }),
			GenerateNewFolderIDs: in.Push.GenerateNewFolderIDs,
		}
	}
	if in.Pull != nil {
		out.Pull = (*JobSyncJobOptions)(in.Pull)
	}
	if in.Migrate != nil {
		out.Migrate = &JobMigrateJobOptions{
			Message:              in.Migrate.Message,
			Branch:               in.Migrate.Branch,
			Resources:            jobConvertSlice(in.Migrate.Resources, func(r HistoricJobResourceRef) JobResourceRef { return JobResourceRef(r) }),
			GenerateNewFolderIDs: in.Migrate.GenerateNewFolderIDs,
			SkipResourceDeletion: in.Migrate.SkipResourceDeletion,
		}
	}
	if in.Delete != nil {
		out.Delete = &JobDeleteJobOptions{
			Ref:       in.Delete.Ref,
			Paths:     in.Delete.Paths,
			Resources: jobConvertSlice(in.Delete.Resources, func(r HistoricJobResourceRef) JobResourceRef { return JobResourceRef(r) }),
		}
	}
	if in.Move != nil {
		out.Move = &JobMoveJobOptions{
			Ref:        in.Move.Ref,
			Paths:      in.Move.Paths,
			TargetPath: in.Move.TargetPath,
			Resources:  jobConvertSlice(in.Move.Resources, func(r HistoricJobResourceRef) JobResourceRef { return JobResourceRef(r) }),
		}
	}
	if in.FixFolderMetadata != nil {
		out.FixFolderMetadata = (*JobFixFolderMetadataJobOptions)(in.FixFolderMetadata)
	}
	if in.Test != nil {
		out.Test = (*JobTestJobOptions)(in.Test)
	}
	return out
}

func historicJobStatusFromJobStatus(in JobStatus) HistoricJobStatus {
	return HistoricJobStatus{
		State:           (*HistoricJobState)(in.State),
		Started:         in.Started,
		Finished:        in.Finished,
		Message:         in.Message,
		Errors:          in.Errors,
		Warnings:        in.Warnings,
		Progress:        in.Progress,
		ProgressUpdates: in.ProgressUpdates,
		Summary:         jobConvertSlice(in.Summary, func(s JobResourceSummary) HistoricJobResourceSummary { return HistoricJobResourceSummary(s) }),
		Url:             (*HistoricJobRepositoryURLs)(in.Url),
	}
}

func historicJobStatusToJobStatus(in HistoricJobStatus) JobStatus {
	return JobStatus{
		State:           (*JobState)(in.State),
		Started:         in.Started,
		Finished:        in.Finished,
		Message:         in.Message,
		Errors:          in.Errors,
		Warnings:        in.Warnings,
		Progress:        in.Progress,
		ProgressUpdates: in.ProgressUpdates,
		Summary:         jobConvertSlice(in.Summary, func(s HistoricJobResourceSummary) JobResourceSummary { return JobResourceSummary(s) }),
		Url:             (*JobRepositoryURLs)(in.Url),
	}
}

func jobConvertSlice[In, Out any](in []In, fn func(In) Out) []Out {
	if in == nil {
		return nil
	}
	out := make([]Out, len(in))
	for i, v := range in {
		out[i] = fn(v)
	}
	return out
}

func jobInt32(field string, v int) (*int32, error) {
	if v < math.MinInt32 || v > math.MaxInt32 {
		return nil, fmt.Errorf("%s: %d does not fit in int32", field, v)
	}
	return jobNonZero(int32(v)), nil
}

func jobDurationToString(d metav1.Duration) *string {
	if d.Duration == 0 {
		return nil
	}
	s := d.Duration.String()
	return &s
}

func jobDurationFromString(field string, s *string) (metav1.Duration, error) {
	if s == nil {
		return metav1.Duration{}, nil
	}
	d, err := time.ParseDuration(*s)
	if err != nil {
		return metav1.Duration{}, fmt.Errorf("%s: %w", field, err)
	}
	return metav1.Duration{Duration: d}, nil
}

// jobNonZero and jobValue are private copies of optional.NonZero and optional.Value
// (apps/provisioning/pkg/util/optional), kept here until that package lands.
func jobNonZero[T comparable](v T) *T {
	var zero T
	if v == zero {
		return nil
	}
	return &v
}

func jobValue[T any](p *T) T {
	if p == nil {
		var zero T
		return zero
	}
	return *p
}
