package git

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func Mutate(_ context.Context, obj runtime.Object) error {
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
			url = strings.TrimRight(url, "/")
			repo.Spec.Git.URL = url
		}
	}

	return nil
}
