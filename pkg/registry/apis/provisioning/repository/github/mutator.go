package github

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
)

func Mutator(secrets secrets.RepositorySecrets) controller.Mutator {
	return func(ctx context.Context, obj runtime.Object) error {
		repo, ok := obj.(*provisioning.Repository)
		if !ok {
			return nil
		}

		if repo.Spec.GitHub == nil {
			return nil
		}

		if repo.Spec.GitHub.Token != "" {
			secretName := repo.Name + githubTokenSecretSuffix
			nameOrValue, err := secrets.Encrypt(ctx, repo, secretName, repo.Spec.GitHub.Token)
			if err != nil {
				return err
			}
			repo.Spec.GitHub.EncryptedToken = nameOrValue
			repo.Spec.GitHub.Token = ""
		}

		return nil
	}
}
