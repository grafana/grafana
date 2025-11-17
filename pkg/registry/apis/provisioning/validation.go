package provisioning

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// RepositoryLister interface for listing repositories
type RepositoryLister interface {
	List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error)
}

// GetRepositoriesInNamespace retrieves all repositories in a given namespace
func GetRepositoriesInNamespace(ctx context.Context, store RepositoryLister) ([]provisioning.Repository, error) {
	var allRepositories []provisioning.Repository
	continueToken := ""

	for {
		obj, err := store.List(ctx, &internalversion.ListOptions{
			Limit:    100,
			Continue: continueToken,
		})
		if err != nil {
			return nil, err
		}

		repositoryList, ok := obj.(*provisioning.RepositoryList)
		if !ok {
			return nil, fmt.Errorf("expected repository list")
		}

		allRepositories = append(allRepositories, repositoryList.Items...)

		continueToken = repositoryList.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return allRepositories, nil
}

// VerifyAgainstExistingRepositories validates a repository configuration against existing repositories
func VerifyAgainstExistingRepositories(ctx context.Context, store RepositoryLister, cfg *provisioning.Repository) *field.Error {
	ctx, _, err := identity.WithProvisioningIdentity(ctx, cfg.Namespace)
	if err != nil {
		return &field.Error{Type: field.ErrorTypeInternal, Detail: err.Error()}
	}
	all, err := GetRepositoriesInNamespace(request.WithNamespace(ctx, cfg.Namespace), store)
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
