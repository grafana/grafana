package git

import (
	"context"
	"fmt"

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

		if repo.Spec.Type != provisioning.GitRepositoryType {
			return nil
		}

		if repo.Spec.Git == nil {
			return fmt.Errorf("git configuration is required for git repository type")
		}

		if repo.Spec.Git.Token != "" {
			secretName := repo.Name + gitTokenSecretSuffix
			nameOrValue, err := secrets.Encrypt(ctx, repo, secretName, repo.Spec.Git.Token)
			if err != nil {
				return err
			}
			repo.Spec.Git.EncryptedToken = nameOrValue
			repo.Spec.Git.Token = ""
		}

		return nil
	}
}
