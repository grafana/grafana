package git

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/ptr"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func Mutate(_ context.Context, obj runtime.Object) error {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Type != provisioning.RepositorySpecTypeGit {
		return nil
	}

	if repo.Spec.Git == nil {
		return fmt.Errorf("git configuration is required for git repository type")
	}

	if ptr.Deref(repo.Spec.Git.Url, "") != "" {
		url := strings.TrimSpace(ptr.Deref(repo.Spec.Git.Url, ""))
		if url != "" {
			url = strings.TrimRight(url, "/")
			repo.Spec.Git.Url = new(url)
		}
	}

	return nil
}
