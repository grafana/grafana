package bitbucket

import (
	"context"
	"regexp"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
)

var bitbucketURLRegex = regexp.MustCompile(`^https://bitbucket\.org/[^/]+/[^/]+(\.git)?/?$`)

// Validate validates the bitbucket repository configuration without requiring decrypted secrets.
func Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Type != provisioning.BitbucketRepositoryType {
		return nil
	}

	cfg := repo.Spec.Bitbucket
	if cfg == nil {
		return field.ErrorList{
			field.Required(field.NewPath("spec", "bitbucket"), "bitbucket configuration is required for bitbucket repository type"),
		}
	}

	var list field.ErrorList

	// Validate URL format
	if cfg.URL == "" {
		list = append(list, field.Required(field.NewPath("spec", "bitbucket", "url"), "a bitbucket url is required"))
	} else if !bitbucketURLRegex.MatchString(cfg.URL) {
		list = append(list, field.Invalid(
			field.NewPath("spec", "bitbucket", "url"),
			cfg.URL,
			"must be a valid Bitbucket repository URL (https://bitbucket.org/workspace/repo)",
		))
	}

	if len(list) > 0 {
		return list
	}

	// Validate git-related fields (branch, path, token/connection) using the shared git validator
	list = append(list, git.ValidateGitConfigFields(repo, cfg.URL, cfg.Branch, cfg.Path)...)
	return list
}
