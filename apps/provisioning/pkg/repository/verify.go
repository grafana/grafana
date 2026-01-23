package repository

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// ErrRepositoryDuplicatePath is returned when a repository has the same path as another
var ErrRepositoryDuplicatePath = fmt.Errorf("duplicate repository path")

// ErrRepositoryParentFolderConflict is returned when a repository path conflicts with a parent folder
var ErrRepositoryParentFolderConflict = fmt.Errorf("repository path conflicts with existing repository")

type VerifyAgainstExistingRepositoriesValidator struct {
	lister RepositoryLister
	limits quotas.QuotaLimits
}

func NewVerifyAgainstExistingRepositoriesValidator(lister RepositoryLister) Validator {
	// Default to 10 repositories for backward compatibility when using the old constructor
	return &VerifyAgainstExistingRepositoriesValidator{
		lister: lister,
		limits: quotas.QuotaLimits{MaxRepositories: 10},
	}
}

// NewVerifyAgainstExistingRepositoriesValidatorWithQuotas creates a validator with quota limits.
// HACK: This is a workaround to avoid changing NewVerifyAgainstExistingRepositoriesValidator signature which would require
// changes in the enterprise repository. This should be merged into NewVerifyAgainstExistingRepositoriesValidator parameters
// once we can coordinate the change across repositories.
func NewVerifyAgainstExistingRepositoriesValidatorWithQuotas(lister RepositoryLister, limits quotas.QuotaLimits) Validator {
	return &VerifyAgainstExistingRepositoriesValidator{
		lister: lister,
		limits: limits,
	}
}

// VerifyAgainstExistingRepositoriesValidator verifies repository configurations for conflicts within a namespace.
//
// This validator enforces the following rules:
// - You can only create an instance sync repository if no other repositories exist in the namespace.
// - You cannot create a folder sync repository if an instance repository already exists in the namespace.
// - Git repositories must not have duplicate or overlapping paths with existing repositories.
// - The total number of repositories in a single namespace cannot exceed the configured limit (default 10, 0 = unlimited).
func (v *VerifyAgainstExistingRepositoriesValidator) Validate(ctx context.Context, cfg *provisioning.Repository) field.ErrorList {
	ctx, _, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
	if err != nil {
		return field.ErrorList{field.InternalError(field.NewPath(""), err)}
	}
	ctx = request.WithNamespace(ctx, cfg.Namespace)

	all, err := v.lister.List(ctx)
	if err != nil {
		return field.ErrorList{field.InternalError(field.NewPath(""), err)}
	}

	if cfg.Spec.Sync.Target == provisioning.SyncTargetTypeInstance {
		// Instance sync can only be created if NO other repositories exist
		for _, v := range all {
			if v.Name != cfg.Name {
				return field.ErrorList{field.Forbidden(field.NewPath("spec", "sync", "target"),
					"Instance repository can only be created when no other repositories exist. Found: "+v.Name)}
			}
		}
	} else {
		// Folder sync cannot be created if an instance repository exists
		for _, v := range all {
			if v.Spec.Sync.Target == provisioning.SyncTargetTypeInstance && v.Name != cfg.Name {
				return field.ErrorList{field.Forbidden(field.NewPath("spec", "sync", "target"),
					"Cannot create folder repository when instance repository exists: "+v.Name)}
			}
		}
	}

	// If repo is git, ensure no other repository is defined with a child path
	if cfg.Spec.Type.IsGit() {
		for _, v := range all {
			// skip itself
			if cfg.Name == v.Name {
				continue
			}
			if v.URL() == cfg.URL() {
				if v.Path() == cfg.Path() {
					return field.ErrorList{field.Invalid(field.NewPath("spec", string(cfg.Spec.Type), "path"),
						cfg.Path(),
						fmt.Sprintf("%s: %s", ErrRepositoryDuplicatePath.Error(), v.Name))}
				}

				relPath, err := filepath.Rel(v.Path(), cfg.Path())
				if err != nil {
					return field.ErrorList{field.Invalid(field.NewPath("spec", string(cfg.Spec.Type), "path"), cfg.Path(), "failed to evaluate path: "+err.Error())}
				}
				// https://pkg.go.dev/path/filepath#Rel
				// Rel will return "../" if the relative paths are not related
				if !strings.HasPrefix(relPath, "../") {
					return field.ErrorList{field.Invalid(field.NewPath("spec", string(cfg.Spec.Type), "path"), cfg.Path(),
						fmt.Sprintf("%s: %s", ErrRepositoryParentFolderConflict.Error(), v.Name))}
				}
			}
		}
	}

	// Check repository limit (0 = unlimited, > 0 = use value)
	maxRepos := v.limits.MaxRepositories
	// Early return if unlimited (0) to avoid unnecessary counting.
	if maxRepos == 0 {
		return nil
	}

	// Count repositories excluding the current one being created/updated
	count := 0
	for _, v := range all {
		if v.Name != cfg.Name {
			count++
		}
	}

	if count >= int(maxRepos) {
		return field.ErrorList{field.Forbidden(field.NewPath("spec"),
			fmt.Sprintf("Maximum number of %d repositories reached", maxRepos))}
	}

	return nil
}
