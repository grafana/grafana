package git

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// Validate validates the git repository configuration without requiring decrypted secrets.
func Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Type != provisioning.GitRepositoryType {
		return nil
	}

	cfg := repo.Spec.Git
	if cfg == nil {
		return field.ErrorList{
			field.Required(field.NewPath("spec", "git"), "git configuration is required for git repository type"),
		}
	}

	return validateGitConfig(repo, cfg)
}

// validateGitConfig validates the git configuration fields.
// This is extracted to be reusable by other git-based repository types (github, gitlab, bitbucket).
func validateGitConfig(repo *provisioning.Repository, cfg *provisioning.GitRepositoryConfig) field.ErrorList {
	return ValidateGitConfigFields(repo, cfg.URL, cfg.Branch, cfg.Path)
}

// ValidateGitConfigFields validates common git configuration fields (Branch, Path, token/connection).
// This can be reused by git-based repository types (github, gitlab, bitbucket).
// The URL parameter is only used for token/connection validation logic, not for URL format validation
// (providers handle their own URL format validation).
func ValidateGitConfigFields(repo *provisioning.Repository, url, branch, path string) field.ErrorList {
	var list field.ErrorList

	t := string(repo.Spec.Type)
	// Note: URL format validation is handled by provider-specific validators.
	// We only validate URL emptiness here for the generic git repository type.
	if repo.Spec.Type == provisioning.GitRepositoryType {
		if url == "" {
			list = append(list, field.Required(field.NewPath("spec", t, "url"), "a git url is required"))
		} else {
			if !isValidGitURL(url) {
				list = append(list, field.Invalid(field.NewPath("spec", t, "url"), url, "invalid git URL format"))
			}
		}
	}

	if branch == "" {
		list = append(list, field.Required(field.NewPath("spec", t, "branch"), "a git branch is required"))
	} else if !IsValidGitBranchName(branch) {
		list = append(list, field.Invalid(field.NewPath("spec", t, "branch"), branch, "invalid branch name"))
	}

	// Readonly repositories may not need a token (if public)
	// HACK - we're checking if the object is new by looking at the generation instead of the action
	// We should fix this in https://github.com/grafana/git-ui-sync-project/issues/746
	isNewObject := repo.Generation == 0
	if len(repo.Spec.Workflows) > 0 {
		// For new objects, if a token is provided, then the connection should not be there
		if !repo.Secure.Token.IsZero() {
			if isNewObject &&
				repo.Spec.Connection != nil &&
				repo.Spec.Connection.Name != "" {
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

	if err := safepath.IsSafe(path); err != nil {
		list = append(list, field.Invalid(field.NewPath("spec", t, "path"), path, err.Error()))
	}

	if safepath.IsAbs(path) {
		list = append(list, field.Invalid(field.NewPath("spec", t, "path"), path, "path must be relative"))
	}

	return list
}
