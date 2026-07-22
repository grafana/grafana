package jobs

import (
	"context"
	"fmt"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/authlib/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	"github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	AnnoAuthor       = "provisioning.grafana.app/author"
	AnnoAuthorEmail  = "provisioning.grafana.app/authorEmail"
	AnnoAuthorID     = "provisioning.grafana.app/authorId"
	AnnoAuthorOrigin = "provisioning.grafana.app/authorOrigin"
)

// ValidateJob performs validation on the Job specification and returns an error if validation fails.
// supportedResources is the configured set of resource types provisioning can manage; export-style
// job options (push and migrate) are validated against it.
func ValidateJob(job *provisioning.Job, supportedResources []provisioning.SupportedResource) error {
	list := field.ErrorList{}

	// Validate action is specified
	if job.Spec.Action == "" {
		list = append(list, field.Required(field.NewPath("spec", "action"), "action must be specified"))
		return toError(job.Name, list) // Early return since we can't validate further without knowing the action
	}

	// Validate repository is specified
	if job.Spec.Repository == "" {
		list = append(list, field.Required(field.NewPath("spec", "repository"), "repository must be specified"))
	}

	// Validate action-specific options
	switch job.Spec.Action {
	case provisioning.JobActionPull:
		if job.Spec.Pull == nil {
			list = append(list, field.Required(field.NewPath("spec", "pull"), "pull options required for pull action"))
		}
		// Pull options are simple, just incremental bool - no further validation needed

	case provisioning.JobActionPush:
		if job.Spec.Push == nil {
			list = append(list, field.Required(field.NewPath("spec", "push"), "push options required for push action"))
		} else {
			list = append(list, validateExportJobOptions(job.Spec.Push, supportedResources)...)
		}

	case provisioning.JobActionPullRequest:
		if job.Spec.PullRequest == nil {
			list = append(list, field.Required(field.NewPath("spec", "pr"), "pull request options required for pr action"))
		}
		// PullRequest options are mostly informational - no strict validation needed

	case provisioning.JobActionMigrate:
		if job.Spec.Migrate == nil {
			list = append(list, field.Required(field.NewPath("spec", "migrate"), "migrate options required for migrate action"))
		} else {
			list = append(list, validateMigrateJobOptions(job.Spec.Migrate, supportedResources)...)
		}

	case provisioning.JobActionDelete:
		if job.Spec.Delete == nil {
			list = append(list, field.Required(field.NewPath("spec", "delete"), "delete options required for delete action"))
		} else {
			list = append(list, validateDeleteJobOptions(job.Spec.Delete)...)
		}

	case provisioning.JobActionMove:
		if job.Spec.Move == nil {
			list = append(list, field.Required(field.NewPath("spec", "move"), "move options required for move action"))
		} else {
			list = append(list, validateMoveJobOptions(job.Spec.Move)...)
		}

	case provisioning.JobActionFixFolderMetadata:
		// No required options for fix-folder-metadata; it's a no-op placeholder

	case provisioning.JobActionTest:
		if job.Spec.Test == nil {
			list = append(list, field.Required(field.NewPath("spec", "test"), "test options required for test action"))
		} else {
			list = append(list, validateTestJobOptions(job.Spec.Test)...)
		}

	case provisioning.JobActionReleaseResources,
		provisioning.JobActionDeleteResources:
		// No additional options required; validation is handled by the jobs connector
		// via inverted repo validation (only allowed when repo is missing or Terminating).

	default:
		list = append(list, field.Invalid(field.NewPath("spec", "action"), job.Spec.Action, "invalid action"))
	}

	return toError(job.Name, list)
}

// toError converts a field.ErrorList to an error, returning nil if the list is empty
func toError(name string, list field.ErrorList) error {
	if len(list) == 0 {
		return nil
	}
	return apierrors.NewInvalid(
		provisioning.JobResourceInfo.GroupVersionKind().GroupKind(),
		name, list)
}

// validateExportJobOptions validates export (push) job options
func validateExportJobOptions(opts *provisioning.ExportJobOptions, supportedResources []provisioning.SupportedResource) field.ErrorList {
	list := field.ErrorList{}

	// Validate branch name if specified
	if opts.Branch != "" {
		if !git.IsValidGitBranchName(opts.Branch) {
			list = append(list, field.Invalid(field.NewPath("spec", "push", "branch"), opts.Branch, "invalid git branch name"))
		}
	}

	// Validate path if specified
	if opts.Path != "" {
		if err := safepath.IsSafe(opts.Path); err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "push", "path"), opts.Path, err.Error()))
		}
	}

	// Empty Resources is valid: the worker falls back to exporting every
	// unmanaged resource (legacy behavior).
	list = append(list, validateExportResourceRefs(field.NewPath("spec", "push", "resources"), opts.Resources, supportedResources)...)

	return list
}

// validateMigrateJobOptions validates migrate job options
func validateMigrateJobOptions(opts *provisioning.MigrateJobOptions, supportedResources []provisioning.SupportedResource) field.ErrorList {
	list := field.ErrorList{} //nolint:prealloc

	// Validate branch name if specified. An empty branch means migrate directly
	// to the configured branch, which is always valid.
	if opts.Branch != "" {
		if !git.IsValidGitBranchName(opts.Branch) {
			list = append(list, field.Invalid(field.NewPath("spec", "migrate", "branch"), opts.Branch, "invalid git branch name"))
		}
	}

	// Empty Resources is valid: the worker falls back to migrating every
	// unmanaged resource (legacy behavior).
	list = append(list, validateExportResourceRefs(field.NewPath("spec", "migrate", "resources"), opts.Resources, supportedResources)...)

	return list
}

// MaxSelectiveExportResources caps how many resources a single export-style job
// (push or migrate) may explicitly request. Selective export fetches each resource
// individually, so an unbounded list would translate into an unbounded number of
// per-resource lookups; this bound keeps a single job's work predictable.
const MaxSelectiveExportResources = 100

// validateExportResourceRefs enforces the rules shared by export-style resource
// lists (push and migrate): name + kind are required, and each kind/group must
// match an active entry in the configured supported-resource set.
func validateExportResourceRefs(base *field.Path, refs []provisioning.ResourceRef, supportedResources []provisioning.SupportedResource) field.ErrorList {
	list := field.ErrorList{}

	if len(refs) > MaxSelectiveExportResources {
		list = append(list, field.TooMany(base, len(refs), MaxSelectiveExportResources))
		return list
	}

	supported := activeExportResources(supportedResources)
	for i, r := range refs {
		path := base.Index(i)
		if r.Name == "" {
			list = append(list, field.Required(path.Child("name"), "resource name is required"))
		}
		if r.Kind == "" {
			list = append(list, field.Required(path.Child("kind"), "resource kind is required"))
			continue
		}

		// A non-empty group must match the group registered for that kind.
		var kindOK, groupOK bool
		for _, s := range supported {
			if s.Kind != r.Kind {
				continue
			}
			kindOK = true
			if r.Group == "" || r.Group == s.Group {
				groupOK = true
				break
			}
		}
		switch {
		case !kindOK:
			list = append(list, field.Invalid(path.Child("kind"), r.Kind,
				fmt.Sprintf("kind is not supported for export; supported kinds: %s", strings.Join(supportedKinds(supported), ", "))))
		case !groupOK:
			list = append(list, field.Invalid(path.Child("group"), r.Group,
				fmt.Sprintf("group %q is not supported for kind %s", r.Group, r.Kind)))
		}
	}
	return list
}

// activeExportResources returns the active subset of the configured supported
// resources. When none are configured it falls back to the dashboard-only
// default, preserving the legacy export behavior.
func activeExportResources(supportedResources []provisioning.SupportedResource) []provisioning.SupportedResource {
	active := make([]provisioning.SupportedResource, 0, len(supportedResources))
	for _, r := range supportedResources {
		if !r.Disabled {
			active = append(active, r)
		}
	}
	if len(active) == 0 {
		return []provisioning.SupportedResource{{
			Group: resources.DashboardResource.Group,
			Kind:  resources.DashboardKind.Kind,
		}}
	}
	return active
}

// supportedKinds returns the kinds in supported, for use in error messages.
func supportedKinds(supported []provisioning.SupportedResource) []string {
	kinds := make([]string, 0, len(supported))
	for _, r := range supported {
		kinds = append(kinds, r.Kind)
	}
	return kinds
}

// validateDeleteJobOptions validates delete job options
func validateDeleteJobOptions(opts *provisioning.DeleteJobOptions) field.ErrorList {
	list := field.ErrorList{}

	// At least one of paths or resources must be specified
	if len(opts.Paths) == 0 && len(opts.Resources) == 0 {
		list = append(list, field.Required(field.NewPath("spec", "delete"), "at least one path or resource must be specified"))
		return list
	}

	// Validate paths
	for i, p := range opts.Paths {
		if err := safepath.IsSafe(p); err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "delete", "paths").Index(i), p, err.Error()))
		}
	}

	// Validate resources
	for i, r := range opts.Resources {
		if r.Name == "" {
			list = append(list, field.Required(field.NewPath("spec", "delete", "resources").Index(i).Child("name"), "resource name is required"))
		}
		if r.Kind == "" {
			list = append(list, field.Required(field.NewPath("spec", "delete", "resources").Index(i).Child("kind"), "resource kind is required"))
		}
	}

	return list
}

// MaxTestJobDuration caps how long a synthetic test job may sleep. It sits
// below the default per-job processing timeout (20m): the driver starts that
// timeout before repository lookup and Process run, so a job allowed to sleep
// for the full timeout would race the deadline and be cancelled — reported as a
// failure — instead of completing. The margin leaves headroom for that preamble.
const MaxTestJobDuration = 15 * time.Minute

// MaxTestJobProgressUpdates caps how many progress notifications a synthetic
// test job may emit. Each update persists status and fans out watch events, so
// this keeps event volume from a single job bounded.
const MaxTestJobProgressUpdates = 1000

// MinTestJobProgressInterval is the minimum spacing between persisted progress
// updates; tighter cadences are coalesced away by the recorder and never
// persist. Mirrors jobs.NotifyThrottleInterval (not importable from this
// module) — keep in sync.
const MinTestJobProgressInterval = 500 * time.Millisecond

// validateTestJobOptions validates performance-testing job options
func validateTestJobOptions(opts *provisioning.TestJobOptions) field.ErrorList {
	list := field.ErrorList{}

	d := opts.Duration.Duration
	switch {
	case d <= 0:
		list = append(list, field.Invalid(field.NewPath("spec", "test", "duration"), opts.Duration.Duration.String(), "duration must be positive"))
	case d > MaxTestJobDuration:
		list = append(list, field.Invalid(field.NewPath("spec", "test", "duration"), opts.Duration.Duration.String(), fmt.Sprintf("duration must not exceed %s", MaxTestJobDuration)))
	}

	updates := opts.ProgressUpdates
	switch {
	case updates < 0:
		list = append(list, field.Invalid(field.NewPath("spec", "test", "progressUpdates"), updates, "progressUpdates must be non-negative"))
	case updates > MaxTestJobProgressUpdates:
		list = append(list, field.Invalid(field.NewPath("spec", "test", "progressUpdates"), updates, fmt.Sprintf("progressUpdates must not exceed %d", MaxTestJobProgressUpdates)))
	case d > 0 && updates > 0 && d/time.Duration(updates) < MinTestJobProgressInterval:
		maxUpdates := int(d / MinTestJobProgressInterval)
		list = append(list, field.Invalid(field.NewPath("spec", "test", "progressUpdates"), updates, fmt.Sprintf("progressUpdates must not exceed %d for a %s duration (updates must be at least %s apart)", maxUpdates, d, MinTestJobProgressInterval)))
	}

	return list
}

// validateMoveJobOptions validates move job options
func validateMoveJobOptions(opts *provisioning.MoveJobOptions) field.ErrorList {
	list := field.ErrorList{}

	// At least one of paths or resources must be specified
	if len(opts.Paths) == 0 && len(opts.Resources) == 0 {
		list = append(list, field.Required(field.NewPath("spec", "move"), "at least one path or resource must be specified"))
		return list
	}

	// Target path is required
	if opts.TargetPath == "" {
		list = append(list, field.Required(field.NewPath("spec", "move", "targetPath"), "target path is required"))
	} else {
		if err := safepath.IsSafe(opts.TargetPath); err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "move", "targetPath"), opts.TargetPath, err.Error()))
		}
	}

	// Validate source paths
	for i, p := range opts.Paths {
		if err := safepath.IsSafe(p); err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "move", "paths").Index(i), p, err.Error()))
		}
	}

	// Validate resources
	for i, r := range opts.Resources {
		if r.Name == "" {
			list = append(list, field.Required(field.NewPath("spec", "move", "resources").Index(i).Child("name"), "resource name is required"))
		}
		if r.Kind == "" {
			list = append(list, field.Required(field.NewPath("spec", "move", "resources").Index(i).Child("kind"), "resource kind is required"))
		}
	}

	return list
}

// PerfTestingEnabledFunc reports whether the synthetic "test" job type is enabled
// for the request in ctx. It is injected so this package need not depend on the
// feature flag implementation, which lives in the main Grafana module.
type PerfTestingEnabledFunc func(ctx context.Context) bool

// AdmissionValidator handles validation for Job resources during admission
type AdmissionValidator struct {
	// supportedResources is the configured set of resource types provisioning can manage,
	// used to validate export-style (push and migrate) job options.
	supportedResources []provisioning.SupportedResource
	perfTestingEnabled PerfTestingEnabledFunc
}

// NewAdmissionValidator creates a new job admission validator. supportedResources is the
// configured set of resource types provisioning can manage. perfTestingEnabled gates
// whether synthetic "test" jobs are allowed.
func NewAdmissionValidator(supportedResources []provisioning.SupportedResource, perfTestingEnabled PerfTestingEnabledFunc) *AdmissionValidator {
	return &AdmissionValidator{supportedResources: supportedResources, perfTestingEnabled: perfTestingEnabled}
}

// Validate validates Job resources during admission
func (v *AdmissionValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil {
		return nil
	}

	// Do not validate objects we are trying to delete
	meta, _ := utils.MetaAccessor(obj)
	if meta.GetDeletionTimestamp() != nil {
		return nil
	}

	job, ok := obj.(*provisioning.Job)
	if !ok {
		return fmt.Errorf("expected job, got %T", obj)
	}

	if err := validateAuthor(ctx, a, job); err != nil {
		return err
	}

	if job.Spec.Action == provisioning.JobActionTest && (v.perfTestingEnabled == nil || !v.perfTestingEnabled(ctx)) {
		return apierrors.NewInvalid(
			provisioning.JobResourceInfo.GroupVersionKind().GroupKind(),
			job.Name,
			field.ErrorList{field.Forbidden(field.NewPath("spec", "action"), "test jobs require the provisioning.performance feature flag")},
		)
	}

	return ValidateJob(job, v.supportedResources)
}

func validateAuthor(ctx context.Context, a admission.Attributes, job *provisioning.Job) error {
	name := job.Annotations[AnnoAuthor]
	email := job.Annotations[AnnoAuthorEmail]
	id := job.Annotations[AnnoAuthorID]
	origin := job.Annotations[AnnoAuthorOrigin]

	switch a.GetOperation() {
	case admission.Create:
		if info, ok := types.AuthInfoFrom(ctx); ok && identity.IsProvisioningServiceIdentity(info) {
			return nil
		}
		if requester, err := identity.GetRequester(ctx); err == nil && requester.IsIdentityType(types.TypeUser) {
			if name == "" && email == "" && id == "" && origin == "" {
				return nil
			}
			if name != requester.GetName() {
				return apierrors.NewBadRequest(fmt.Sprintf("annotation %s must match the requesting user", AnnoAuthor))
			}
			if email != requester.GetEmail() {
				return apierrors.NewBadRequest(fmt.Sprintf("annotation %s must match the requesting user", AnnoAuthorEmail))
			}
			if id != requester.GetUID() {
				return apierrors.NewBadRequest(fmt.Sprintf("annotation %s must match the requesting user", AnnoAuthorID))
			}
			if origin != "Grafana" {
				return apierrors.NewBadRequest(fmt.Sprintf("annotation %s must be Grafana for user-created jobs", AnnoAuthorOrigin))
			}
			return nil
		}
		if name != "" || email != "" || id != "" {
			return apierrors.NewBadRequest("job author annotations may only be set by a user or the provisioning service")
		}
		if origin != "" && origin != "Unknown" {
			return apierrors.NewBadRequest(fmt.Sprintf("annotation %s must be Unknown when no user or provisioning service is involved", AnnoAuthorOrigin))
		}
	case admission.Update:
		old, ok := a.GetOldObject().(*provisioning.Job)
		if !ok {
			return nil
		}
		for anno, value := range map[string]string{
			AnnoAuthor:       name,
			AnnoAuthorEmail:  email,
			AnnoAuthorID:     id,
			AnnoAuthorOrigin: origin,
		} {
			if old.Annotations[anno] != value {
				return apierrors.NewBadRequest(fmt.Sprintf("annotation %s is immutable", anno))
			}
		}
	case admission.Delete, admission.Connect:
	}

	return nil
}

// HistoricJobAdmissionValidator handles validation for HistoricJob resources during admission.
// HistoricJobs are read-only records of completed jobs, so validation is minimal.
type HistoricJobAdmissionValidator struct{}

// NewHistoricJobAdmissionValidator creates a new historic job admission validator
func NewHistoricJobAdmissionValidator() *HistoricJobAdmissionValidator {
	return &HistoricJobAdmissionValidator{}
}

// Validate validates HistoricJob resources during admission.
// Since HistoricJobs are system-created records of completed jobs,
// we only perform basic structural validation.
func (v *HistoricJobAdmissionValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil {
		return nil
	}

	// Do not validate objects we are trying to delete
	meta, _ := utils.MetaAccessor(obj)
	if meta.GetDeletionTimestamp() != nil {
		return nil
	}

	historicJob, ok := obj.(*provisioning.HistoricJob)
	if !ok {
		return fmt.Errorf("expected historic job, got %T", obj)
	}

	// HistoricJobs share the same spec structure as Jobs, so we can reuse validation
	// This ensures that any historic job stored is well-formed
	return validateHistoricJob(historicJob)
}

// validateHistoricJob performs basic validation on historic job records
func validateHistoricJob(job *provisioning.HistoricJob) error {
	list := field.ErrorList{}

	// Validate that required fields are present
	if job.Spec.Action == "" {
		list = append(list, field.Required(field.NewPath("spec", "action"), "action must be specified"))
	}

	if job.Spec.Repository == "" {
		list = append(list, field.Required(field.NewPath("spec", "repository"), "repository must be specified"))
	}

	if len(list) == 0 {
		return nil
	}

	return apierrors.NewInvalid(
		provisioning.HistoricJobResourceInfo.GroupVersionKind().GroupKind(),
		job.Name, list)
}
