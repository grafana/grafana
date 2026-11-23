package local

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/utils/ptr"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// Validate validates the local repository configuration without requiring decrypted secrets.
// The resolver is needed to validate the local path against permitted prefixes.
func Validate(_ context.Context, obj runtime.Object, resolver *LocalFolderResolver) field.ErrorList {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Type != provisioning.RepositorySpecTypeLocal {
		return nil
	}

	cfg := repo.Spec.Local
	if cfg == nil {
		return field.ErrorList{
			field.Required(field.NewPath("spec", "local"), "local configuration is required for local repository type"),
		}
	}

	var list field.ErrorList

	// The path value must be set for local provisioning
	if ptr.Deref(cfg.Path, "") == "" {
		list = append(list, field.Required(field.NewPath("spec", "local", "path"), "must enter a path to local file"))
		return list
	}

	if err := safepath.IsSafe(ptr.Deref(cfg.Path, "")); err != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "local", "path"), ptr.Deref(cfg.Path, ""), err.Error()))
		return list
	}

	// Check if it is valid according to permitted prefixes
	if resolver != nil {
		_, err := resolver.LocalPath(ptr.Deref(cfg.Path, ""))
		if err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "local", "path"), ptr.Deref(cfg.Path, ""), err.Error()))
		}
	}

	return list
}
