package github

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func Mutate(_ context.Context, obj runtime.Object) error {
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

	// For new resources, we create a dummy Token which will be updated by the controller.
	isNewResource := repo.Generation == 0
	if isNewResource && repo.Spec.Connection != nil && repo.Spec.Connection.Name != "" {
		repo.Secure.Token = common.InlineSecureValue{Create: common.RawSecureValue(repo.Spec.Connection.Name)}
	}

	return nil
}
