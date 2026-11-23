package github

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/utils/ptr"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
)

// Validate validates the github repository configuration without requiring decrypted secrets.
// allowInsecure permits http:// URLs together with a token (cleartext credentials); it should
// only be true for local/dev environments.
func Validate(_ context.Context, obj runtime.Object, allowInsecure bool) field.ErrorList {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Type != provisioning.RepositorySpecTypeGithub {
		return nil
	}

	gh := repo.Spec.Github
	if gh == nil {
		return field.ErrorList{
			field.Required(field.NewPath("spec", "github"), "a github config is required"),
		}
	}

	var list field.ErrorList

	if ptr.Deref(gh.Url, "") == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "url"), "a github url is required"))
	} else {
		_, _, err := ParseOwnerRepoGithub(ptr.Deref(gh.Url, ""))
		if err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), ptr.Deref(gh.Url, ""), err.Error()))
		}
		// Allow any HTTPS or HTTP GitHub server (github.com, GitHub Enterprise, local instances, etc.)
		if !strings.HasPrefix(ptr.Deref(gh.Url, ""), "https://") && !strings.HasPrefix(ptr.Deref(gh.Url, ""), "http://") {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), ptr.Deref(gh.Url, ""), "URL must start with https:// or http://"))
		}
	}

	if len(list) > 0 {
		return list
	}

	// A custom webhook URL and disabling webhooks are mutually exclusive:
	// one says "receive webhooks at this address" while the other says "never use webhooks."
	if repo.Spec.Webhook != nil && ptr.Deref(repo.Spec.Webhook.Disabled, false) && ptr.Deref(repo.Spec.Webhook.BaseUrl, "") != "" {
		list = append(list, field.Invalid(
			field.NewPath("spec", "webhook", "disabled"),
			ptr.Deref(repo.Spec.Webhook.Disabled, false),
			"cannot be true when spec.webhook.baseUrl is set",
		))
	}

	// Validate git-related fields (branch, path, token/connection) using the shared git validator
	list = append(list, git.ValidateGitConfigFields(repo, ptr.Deref(gh.Url, ""), gh.Branch, ptr.Deref(gh.Path, ""), allowInsecure)...)
	return list
}
