package git

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// Validate validates the git repository configuration without requiring decrypted secrets.
func Validate(_ context.Context, obj runtime.Object) error {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Type != provisioning.GitRepositoryType {
		return nil
	}

	cfg := repo.Spec.Git
	if cfg == nil {
		return toRepoError(repo.Name, field.ErrorList{
			field.Required(field.NewPath("spec", "git"), "git configuration is required for git repository type"),
		})
	}

	list := validateGitConfig(repo, cfg)
	return toRepoError(repo.Name, list)
}

// validateGitConfig validates the git configuration fields.
// This is extracted to be reusable by other git-based repository types (github, gitlab, bitbucket).
func validateGitConfig(repo *provisioning.Repository, cfg *provisioning.GitRepositoryConfig) field.ErrorList {
	var list field.ErrorList

	t := string(repo.Spec.Type)
	if cfg.URL == "" {
		list = append(list, field.Required(field.NewPath("spec", t, "url"), "a git url is required"))
	} else {
		if !isValidGitURL(cfg.URL) {
			list = append(list, field.Invalid(field.NewPath("spec", t, "url"), cfg.URL, "invalid git URL format"))
		}
	}

	if cfg.Branch == "" {
		list = append(list, field.Required(field.NewPath("spec", t, "branch"), "a git branch is required"))
	} else if !IsValidGitBranchName(cfg.Branch) {
		list = append(list, field.Invalid(field.NewPath("spec", t, "branch"), cfg.Branch, "invalid branch name"))
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

	if err := safepath.IsSafe(cfg.Path); err != nil {
		list = append(list, field.Invalid(field.NewPath("spec", t, "path"), cfg.Path, err.Error()))
	}

	if safepath.IsAbs(cfg.Path) {
		list = append(list, field.Invalid(field.NewPath("spec", t, "path"), cfg.Path, "path must be relative"))
	}

	return list
}

func toRepoError(name string, list field.ErrorList) error {
	if len(list) == 0 {
		return nil
	}

	return list.ToAggregate()
}
