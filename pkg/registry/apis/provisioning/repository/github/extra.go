package github

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	commonMeta "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/git"
	"k8s.io/apimachinery/pkg/runtime"
)

type extra struct {
	factory   *Factory
	decrypter repository.Decrypter
	mutate    repository.Mutator
}

func Extra(decrypter repository.Decrypter, factory *Factory) repository.Extra {
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

	return ghRepo, nil
}

func (e *extra) Mutate(ctx context.Context, obj runtime.Object) error {
	return e.mutate(ctx, obj)
}
