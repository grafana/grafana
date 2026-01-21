package repository

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// ErrRepositoryDuplicatePath is returned when a repository has the same path as another
var ErrRepositoryDuplicatePath = fmt.Errorf("duplicate repository path")

// ErrRepositoryParentFolderConflict is returned when a repository path conflicts with a parent folder
var ErrRepositoryParentFolderConflict = fmt.Errorf("repository path conflicts with existing repository")

// AdditionalValidatorFunc is a function that validates a repository configuration.
// It returns a *field.Error on validation failure, or nil on success.
// Callers should type-assert the error to *field.Error if needed.
type AdditionalValidatorFunc func(ctx context.Context, cfg *provisioning.Repository) error

// NewExistingRepositoriesValidator creates a validator function that checks repository configurations
// against existing repositories in the namespace.
//
// The returned function checks for:
// - Instance sync repositories can only be created if no other repositories exist
// - Folder sync repositories cannot be created if an instance repository exists
// - Git repositories cannot have duplicate or conflicting paths
// - Maximum of 10 repositories per namespace
func NewExistingRepositoriesValidator(lister *Lister) AdditionalValidatorFunc {
	return func(ctx context.Context, cfg *provisioning.Repository) error {
		ctx, _, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
		if err != nil {
			return &field.Error{Type: field.ErrorTypeInternal, Detail: err.Error()}
		}
		ctx = request.WithNamespace(ctx, cfg.Namespace)

		all, err := lister.List(ctx)
		if err != nil {
			return field.Forbidden(field.NewPath("spec"),
				"Unable to verify root target: "+err.Error())
		}

		if cfg.Spec.Sync.Target == provisioning.SyncTargetTypeInstance {
			// Instance sync can only be created if NO other repositories exist
			for _, v := range all {
				if v.Name != cfg.Name {
					return field.Forbidden(field.NewPath("spec", "sync", "target"),
						"Instance repository can only be created when no other repositories exist. Found: "+v.Name)
				}
			}
		} else {
			// Folder sync cannot be created if an instance repository exists
			for _, v := range all {
				if v.Spec.Sync.Target == provisioning.SyncTargetTypeInstance && v.Name != cfg.Name {
					return field.Forbidden(field.NewPath("spec", "sync", "target"),
						"Cannot create folder repository when instance repository exists: "+v.Name)
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
						return field.Invalid(field.NewPath("spec", string(cfg.Spec.Type), "path"),
							cfg.Path(),
							fmt.Sprintf("%s: %s", ErrRepositoryDuplicatePath.Error(), v.Name))
					}

					relPath, err := filepath.Rel(v.Path(), cfg.Path())
					if err != nil {
						return field.Invalid(field.NewPath("spec", string(cfg.Spec.Type), "path"), cfg.Path(), "failed to evaluate path: "+err.Error())
					}
					// https://pkg.go.dev/path/filepath#Rel
					// Rel will return "../" if the relative paths are not related
					if !strings.HasPrefix(relPath, "../") {
						return field.Invalid(field.NewPath("spec", string(cfg.Spec.Type), "path"), cfg.Path(),
							fmt.Sprintf("%s: %s", ErrRepositoryParentFolderConflict.Error(), v.Name))
					}
				}
			}
		}

		// Count repositories excluding the current one being created/updated
		count := 0
		for _, v := range all {
			if v.Name != cfg.Name {
				count++
			}
		}
		if count >= 10 {
			return field.Forbidden(field.NewPath("spec"),
				"Maximum number of 10 repositories reached")
		}

		return nil
	}
}
