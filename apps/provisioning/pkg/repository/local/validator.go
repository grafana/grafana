package local

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// Validate validates the local repository configuration without requiring decrypted secrets.
// The resolver is needed to validate the local path against permitted prefixes.
func Validate(_ context.Context, obj runtime.Object, resolver *LocalFolderResolver) error {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Type != provisioning.LocalRepositoryType {
		return nil
	}

	cfg := repo.Spec.Local
	if cfg == nil {
		return toRepoError(repo.Name, field.ErrorList{
			field.Required(field.NewPath("spec", "local"), "local configuration is required for local repository type"),
		})
	}

	var list field.ErrorList

	// The path value must be set for local provisioning
	if cfg.Path == "" {
		list = append(list, field.Required(field.NewPath("spec", "local", "path"), "must enter a path to local file"))
		return toRepoError(repo.Name, list)
	}

	if err := safepath.IsSafe(cfg.Path); err != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "local", "path"), cfg.Path, err.Error()))
		return toRepoError(repo.Name, list)
	}

	// Check if it is valid according to permitted prefixes
	if resolver != nil {
		_, err := resolver.LocalPath(cfg.Path)
		if err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "local", "path"), cfg.Path, err.Error()))
		}
	}

	return toRepoError(repo.Name, list)
}

func toRepoError(name string, list field.ErrorList) error {
	if len(list) == 0 {
		return nil
	}

	return list.ToAggregate()
}
