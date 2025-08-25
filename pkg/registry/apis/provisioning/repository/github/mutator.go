package github

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

func Mutator() repository.Mutator {
	return func(ctx context.Context, obj runtime.Object) error {
		repo, ok := obj.(*provisioning.Repository)
		if !ok {
			return nil
		}

		if repo.Spec.GitHub == nil {
			return nil
		}

		// Trim trailing ".git" and any trailing slash from the GitHub URL, if present, using the strings package.
		if repo.Spec.GitHub.URL != "" {
			url := repo.Spec.GitHub.URL
			url = strings.TrimRight(url, "/")
			url = strings.TrimSuffix(url, ".git")
			url = strings.TrimRight(url, "/")
			repo.Spec.GitHub.URL = url
		}

		return nil
	}
}
