package github

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	commonMeta "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks"
	"k8s.io/apimachinery/pkg/runtime"
)

type extra struct {
	factory      *Factory
	decrypter    repository.Decrypter
	mutate       repository.Mutator
	webhookExtra *webhooks.WebhookExtra
}

func Extra(decrypter repository.Decrypter, factory *Factory, webhookExtra *webhooks.WebhookExtra) repository.Extra {
	return &extra{
		decrypter: decrypter,
		factory:   factory,
		mutate:    Mutator(),
	}
}

func (e *extra) Type() provisioning.RepositoryType {
	return provisioning.GitHubRepositoryType
}

func (e *extra) Build(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	logger := logging.FromContext(ctx).With("url", r.Spec.GitHub.URL, "branch", r.Spec.GitHub.Branch, "path", r.Spec.GitHub.Path)
	logger.Info("Instantiating Github repository")

	secure := e.decrypter(r)
	ghCfg := r.Spec.GitHub
	if ghCfg == nil {
		return nil, fmt.Errorf("github configuration is required for nano git")
	}

	var token commonMeta.RawSecureValue
	if r.Secure.Token.IsZero() {
		t, err := secure.Token(ctx)
		if err != nil {
			return nil, fmt.Errorf("unable to decrypt token: %w", err)
		}
		token = t
	}

	gitCfg := git.RepositoryConfig{
		URL:    ghCfg.URL,
		Branch: ghCfg.Branch,
		Path:   ghCfg.Path,
		Token:  token,
	}

	gitRepo, err := git.NewGitRepository(ctx, r, gitCfg)
	if err != nil {
		return nil, fmt.Errorf("error creating git repository: %w", err)
	}

	ghRepo, err := NewGitHub(ctx, r, gitRepo, e.factory, token)
	if err != nil {
		return nil, fmt.Errorf("error creating github repository: %w", err)
	}

	webhookURL := e.webhookExtra.WebhookURL(ctx, r)
	if len(webhookURL) == 0 || err != nil {
		logger.Debug("Skipping webhook setup as no webhooks are not configured")
		return ghRepo, nil
	}

	webhookSecret, err := secure.WebhookSecret(ctx)
	if err != nil {
		return nil, fmt.Errorf("decrypt webhookSecret: %w", err)
	}

	return NewGithubWebhookRepository(ghRepo, webhookURL, webhookSecret), nil
}

func (e *extra) Mutate(ctx context.Context, obj runtime.Object) error {
	return e.mutate(ctx, obj)
}
