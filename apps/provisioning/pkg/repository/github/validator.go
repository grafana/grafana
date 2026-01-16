package github

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// Validate validates the github repository configuration without requiring decrypted secrets.
func Validate(_ context.Context, obj runtime.Object) error {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Type != provisioning.GitHubRepositoryType {
		return nil
	}

	gh := repo.Spec.GitHub
	if gh == nil {
		return toRepoError(repo.Name, field.ErrorList{
			field.Required(field.NewPath("spec", "github"), "a github config is required"),
		})
	}

	var list field.ErrorList

	if gh.URL == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "url"), "a github url is required"))
	} else {
		_, _, err := ParseOwnerRepoGithub(gh.URL)
		if err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, err.Error()))
		} else if !strings.HasPrefix(gh.URL, "https://github.com/") {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, "URL must start with https://github.com/"))
		}
	}

	if len(list) > 0 {
		return toRepoError(repo.Name, list)
	}

	// Validate git-related fields (branch, path, token/connection)
	list = validateGitFields(repo, gh)
	return toRepoError(repo.Name, list)
}

// validateGitFields validates the git-related fields for GitHub repositories.
func validateGitFields(repo *provisioning.Repository, gh *provisioning.GitHubRepositoryConfig) field.ErrorList {
	var list field.ErrorList

	if gh.Branch == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "branch"), "a git branch is required"))
	} else if !git.IsValidGitBranchName(gh.Branch) {
		list = append(list, field.Invalid(field.NewPath("spec", "github", "branch"), gh.Branch, "invalid branch name"))
	}

	// Readonly repositories may not need a token (if public)
	if len(repo.Spec.Workflows) > 0 {
		// If a token is provided, then the connection should not be there
		if !repo.Secure.Token.IsZero() {
			if repo.Spec.Connection != nil && repo.Spec.Connection.Name != "" {
				list = append(
					list,
					field.Invalid(
						field.NewPath("spec", "connection", "name"),
						repo.Spec.Connection.Name,
						"cannot have both connection and token defined",
					),
					field.Invalid(
						field.NewPath("secure", "token"),
						"[REDACTED]",
						"cannot have both connection and token defined",
					),
				)
			}
		} else {
			if repo.Spec.Connection == nil || repo.Spec.Connection.Name == "" {
				list = append(
					list,
					field.Required(
						field.NewPath("spec", "connection"),
						"either a token or a connection should be provided",
					),
					field.Required(
						field.NewPath("secure", "token"),
						"either a token or a connection should be provided",
					),
				)
			}
		}
	}

	if err := safepath.IsSafe(gh.Path); err != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "github", "path"), gh.Path, err.Error()))
	}

	if safepath.IsAbs(gh.Path) {
		list = append(list, field.Invalid(field.NewPath("spec", "github", "path"), gh.Path, "path must be relative"))
	}

	return list
}

func toRepoError(name string, list field.ErrorList) error {
	if len(list) == 0 {
		return nil
	}

	return list.ToAggregate()
}
