package repository

import (
	"context"
	"fmt"
	"path"
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
	lister      RepositoryLister
	quotaGetter quotas.QuotaGetter
}

func NewVerifyAgainstExistingRepositoriesValidator(lister RepositoryLister, quotaGetter quotas.QuotaGetter) Validator {
	// Default to 10 repositories for backward compatibility when using the old constructor
	return &VerifyAgainstExistingRepositoriesValidator{
		lister:      lister,
		quotaGetter: quotaGetter,
	}
}

// pathsOverlap reports whether a and b are the same directory tree, or one is nested inside the
// other, checked in both directions - either the new or the existing repository could be the
// ancestor. An empty path is the repository root, which contains every other path.
func pathsOverlap(a, b string) bool {
	if a == "" || b == "" {
		return true
	}
	a = strings.Trim(path.Clean(a), "/")
	b = strings.Trim(path.Clean(b), "/")
	return a == b || strings.HasPrefix(a, b+"/") || strings.HasPrefix(b, a+"/")
}

// VerifyAgainstExistingRepositoriesValidator verifies repository configurations for conflicts within a namespace.
//
// This validator enforces the following rules:
// - You can only create an instance sync repository if no other repositories exist in the namespace.
// - You cannot create a non-instance (folder or folderless) sync repository if an instance repository already exists in the namespace.
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
		// Folder and folderless sync cannot be created if an instance repository exists
		for _, v := range all {
			if v.Spec.Sync.Target == provisioning.SyncTargetTypeInstance && v.Name != cfg.Name {
				return field.ErrorList{field.Forbidden(field.NewPath("spec", "sync", "target"),
					"Cannot create repository when instance repository exists: "+v.Name)}
			}
		}
	}

	// Git repositories must not have duplicate or overlapping paths with existing repositories,
	// regardless of Sync.Enabled: a disabled repository can still be synced on demand (an
	// explicit pull job, or a PR/branch webhook), so it isn't inert with respect to this conflict.
	if cfg.Spec.Type.IsGit() {
		for _, v := range all {
			// skip itself
			if cfg.Name == v.Name {
				continue
			}
			if v.URL() != cfg.URL() || v.Branch() != cfg.Branch() {
				continue
			}
			if v.Path() == cfg.Path() {
				return field.ErrorList{field.Invalid(field.NewPath("spec", string(cfg.Spec.Type), "path"),
					cfg.Path(),
					fmt.Sprintf("%s: %s", ErrRepositoryDuplicatePath.Error(), v.Name))}
			}

			// Skip parent/child conflict check when both paths are empty (both at repository root)
			if v.Path() != "" || cfg.Path() != "" {
				if pathsOverlap(v.Path(), cfg.Path()) {
					return field.ErrorList{field.Invalid(field.NewPath("spec", string(cfg.Spec.Type), "path"), cfg.Path(),
						fmt.Sprintf("%s: %s", ErrRepositoryParentFolderConflict.Error(), v.Name))}
				}
			}
		}
	}

	// Get quota status for the namespace
	quotaStatus, err := v.quotaGetter.GetQuotaStatus(ctx, cfg.Namespace)
	if err != nil {
		isExistingRepo := false
		for i := range all {
			if all[i].Name == cfg.Name {
				quotaStatus = all[i].Status.Quota
				isExistingRepo = true
				break
			}
		}

		// A repository is new only when it is absent from storage. ObservedGeneration may remain zero
		// when the first reconciliation fails after caching quota.
		if !isExistingRepo {
			return field.ErrorList{field.InternalError(field.NewPath(""), fmt.Errorf("failed to get quota status: %w", err))}
		}
	}

	// Check repository limit (0 = unlimited, > 0 = use value).
	// Only enforce on creation — updating an existing repo should never be
	// blocked by a quota that was lowered after the repo was created.
	maxRepos := quotaStatus.MaxRepositories
	if maxRepos == 0 {
		return nil
	}

	count := 0
	for _, v := range all {
		// If the repository is being updated, allow it even if the quota is reached
		if v.Name == cfg.Name {
			return nil
		} else {
			count++
		}
	}

	if count >= int(maxRepos) {
		return field.ErrorList{field.Forbidden(field.NewPath("spec"),
			fmt.Sprintf("Maximum number of %d repositories reached", maxRepos))}
	}

	return nil
}
