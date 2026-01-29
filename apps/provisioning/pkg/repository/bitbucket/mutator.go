package bitbucket

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Mutate normalizes the Bitbucket repository configuration.
func Mutate(_ context.Context, obj runtime.Object) error {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Bitbucket == nil {
		return nil
	}

	// Normalize the Bitbucket URL and ensure it ends with .git for git protocol
	if repo.Spec.Bitbucket.URL != "" {
		url := strings.TrimSpace(repo.Spec.Bitbucket.URL)
		url = strings.TrimRight(url, "/")
		// Bitbucket git protocol requires .git suffix
		if !strings.HasSuffix(url, ".git") {
			url = url + ".git"
		}
		repo.Spec.Bitbucket.URL = url
	}

	return nil
}
