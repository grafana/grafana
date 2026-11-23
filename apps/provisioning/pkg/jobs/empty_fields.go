package jobs

import (
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// clearEmptyOptionalFields drops explicitly empty optional values from a Job. These fields used
// to be omitempty values, so clients sending "" or 0 got them omitted from the stored object.
// IsFork is left alone: it has always been a pointer and false is meaningful.
func clearEmptyOptionalFields(job *provisioning.Job) {
	spec := &job.Spec
	clearIfEmpty(&spec.Repository)
	clearIfEmpty(&spec.Message)
	if o := spec.Pr; o != nil {
		clearIfEmpty(&o.Ref)
		clearIfEmpty(&o.Pr)
		clearIfEmpty(&o.Hash)
		clearIfEmpty(&o.Url)
		clearIfEmpty(&o.ForkURL)
	}
	if o := spec.Push; o != nil {
		clearIfEmpty(&o.Message)
		clearIfEmpty(&o.Folder)
		clearIfEmpty(&o.Branch)
		clearIfEmpty(&o.Path)
		clearIfEmpty(&o.GenerateNewFolderIDs)
		clearResourceRefs(o.Resources)
	}
	if o := spec.Migrate; o != nil {
		clearIfEmpty(&o.Message)
		clearIfEmpty(&o.Branch)
		clearIfEmpty(&o.GenerateNewFolderIDs)
		clearIfEmpty(&o.SkipResourceDeletion)
		clearResourceRefs(o.Resources)
	}
	if o := spec.Delete; o != nil {
		clearIfEmpty(&o.Ref)
		clearResourceRefs(o.Resources)
	}
	if o := spec.Move; o != nil {
		clearIfEmpty(&o.Ref)
		clearIfEmpty(&o.TargetPath)
		clearResourceRefs(o.Resources)
	}
	if o := spec.FixFolderMetadata; o != nil {
		clearIfEmpty(&o.Ref)
	}
	if o := spec.Test; o != nil {
		clearIfEmpty(&o.ProgressUpdates)
	}

	status := &job.Status
	clearIfEmpty(&status.State)
	clearIfEmpty(&status.Started)
	clearIfEmpty(&status.Finished)
	clearIfEmpty(&status.Message)
	clearIfEmpty(&status.Progress)
	clearIfEmpty(&status.ProgressUpdates)
	for i := range status.Summary {
		s := &status.Summary[i]
		clearIfEmpty(&s.Group)
		clearIfEmpty(&s.Kind)
		for _, count := range []**int64{&s.Total, &s.Create, &s.Update, &s.Delete, &s.Write, &s.Error, &s.Warning, &s.Noop, &s.TotalChanges} {
			clearIfEmpty(count)
		}
	}
}

func clearResourceRefs(refs []provisioning.JobResourceRef) {
	for i := range refs {
		clearIfEmpty(&refs[i].Name)
		clearIfEmpty(&refs[i].Kind)
		clearIfEmpty(&refs[i].Group)
	}
}

func clearIfEmpty[T comparable](field **T) {
	var zero T
	if *field != nil && **field == zero {
		*field = nil
	}
}
