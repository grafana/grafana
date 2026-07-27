package github

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func Mutate(_ context.Context, obj runtime.Object) error {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.GitHub == nil {
		return nil
	}

	repo.Spec.GitHub.URL = NormalizeGitHubURL(repo.Spec.GitHub.URL)

	return nil
}

// NormalizeGitHubURL trims any trailing ".git" and surrounding slashes from a GitHub URL.
// Shared with the GitHub Enterprise Server mutator since both target a repository URL of the same shape.
func NormalizeGitHubURL(url string) string {
	if url == "" {
		return url
	}
	url = strings.TrimRight(url, "/")
	url = strings.TrimSuffix(url, ".git")
	url = strings.TrimRight(url, "/")
	return url
}
