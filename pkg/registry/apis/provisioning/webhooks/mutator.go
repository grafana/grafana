package webhooks

import (
	"context"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"k8s.io/apimachinery/pkg/runtime"
)

func Mutator(secrets secrets.RepositorySecrets) controller.Mutator {
	return func(ctx context.Context, obj runtime.Object) error {
		repo, ok := obj.(*provisioning.Repository)
		if !ok {
			return nil
		}

		if repo.Status.Webhook == nil {
			return nil
		}

		if repo.Status.Webhook.Secret != "" {
			secretName := repo.Name + webhookSecretSuffix
			nameOrValue, err := secrets.Encrypt(ctx, repo, secretName, repo.Status.Webhook.Secret)
			if err != nil {
				return err
			}
			repo.Status.Webhook.EncryptedSecret = nameOrValue
			repo.Status.Webhook.Secret = ""
		}

		return nil
	}
}
