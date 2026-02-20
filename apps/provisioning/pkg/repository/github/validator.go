package github

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
)

// Validate validates the github repository configuration without requiring decrypted secrets.
func Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Type != provisioning.GitHubRepositoryType {
		return nil
	}

	gh := repo.Spec.GitHub
	if gh == nil {
		return field.ErrorList{
			field.Required(field.NewPath("spec", "github"), "a github config is required"),
		}
	}

	var list field.ErrorList

	if gh.URL == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "url"), "a github url is required"))
	} else {
		_, _, err := ParseOwnerRepoGithub(gh.URL)
		if err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, err.Error()))
		}
		// Allow any HTTPS or HTTP GitHub server (github.com, GitHub Enterprise, local instances, etc.)
		if !strings.HasPrefix(gh.URL, "https://") && !strings.HasPrefix(gh.URL, "http://") {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, "URL must start with https:// or http://"))
		}
	}

	if len(list) > 0 {
		return list
	}

	// Validate git-related fields (branch, path, token/connection) using the shared git validator
	list = append(list, git.ValidateGitConfigFields(repo, gh.URL, gh.Branch, gh.Path)...)
	return list
}
