package git

import (
	"context"
	"fmt"
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

		if repo.Spec.Type != provisioning.GitRepositoryType {
			return nil
		}

		if repo.Spec.Git == nil {
			return fmt.Errorf("git configuration is required for git repository type")
		}

		if repo.Spec.Git.URL != "" {
			url := strings.TrimSpace(repo.Spec.Git.URL)
			if url != "" {
				// Remove any trailing slashes
				url = strings.TrimRight(url, "/")
				// Only add .git if it's not already present
				if !strings.HasSuffix(url, ".git") {
					url = url + ".git"
				}
				repo.Spec.Git.URL = url
			}
		}

		return nil
	}
}
