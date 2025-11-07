package jobs

import (
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// ValidateJob performs validation on the Job specification and returns an error if validation fails
func ValidateJob(job *provisioning.Job) error {
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
			list = append(list, validateExportJobOptions(job.Spec.Push)...)
		}

	case provisioning.JobActionPullRequest:
		if job.Spec.PullRequest == nil {
			list = append(list, field.Required(field.NewPath("spec", "pr"), "pull request options required for pr action"))
		}
		// PullRequest options are mostly informational - no strict validation needed

	case provisioning.JobActionMigrate:
		if job.Spec.Migrate == nil {
			list = append(list, field.Required(field.NewPath("spec", "migrate"), "migrate options required for migrate action"))
		}
		// Migrate options are simple - no further validation needed

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
func validateExportJobOptions(opts *provisioning.ExportJobOptions) field.ErrorList {
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

	return list
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
