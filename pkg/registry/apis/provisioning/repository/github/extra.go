package github

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
)

type extra struct {
	factory *Factory
	secrets secrets.RepositorySecrets
}

func Extra(secrets secrets.RepositorySecrets, factory *Factory) repository.Extra {
	// FIXME: probably we should encapsulate the creation of the github factory here
	return &extra{secrets: secrets, factory: factory}
}

func (e *extra) Type() provisioning.RepositoryType {
	return provisioning.GitHubRepositoryType
}

func (e *extra) Build(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	logger := logging.FromContext(ctx).With("url", r.Spec.GitHub.URL, "branch", r.Spec.GitHub.Branch, "path", r.Spec.GitHub.Path)
	logger.Info("Instantiating Github repository")

	ghCfg := r.Spec.GitHub
	if ghCfg == nil {
		return nil, fmt.Errorf("github configuration is required for nano git")
	}

	// Decrypt GitHub token if needed
	ghToken := ghCfg.Token
	if ghToken == "" && len(ghCfg.EncryptedToken) > 0 {
		decrypted, err := e.secrets.Decrypt(ctx, r, string(ghCfg.EncryptedToken))
		if err != nil {
			return nil, fmt.Errorf("decrypt github token: %w", err)
		}
		ghToken = string(decrypted)
	}

	gitCfg := git.RepositoryConfig{
		URL:            ghCfg.URL,
		Branch:         ghCfg.Branch,
		Path:           ghCfg.Path,
		Token:          ghToken,
		EncryptedToken: ghCfg.EncryptedToken,
	}

	gitRepo, err := git.NewGitRepository(ctx, r, gitCfg, e.secrets)
	if err != nil {
		return nil, fmt.Errorf("error creating git repository: %w", err)
	}

	ghRepo, err := NewGitHub(ctx, r, gitRepo, e.factory, ghToken, e.secrets)
	if err != nil {
		return nil, fmt.Errorf("error creating github repository: %w", err)
	}

	return ghRepo, nil
}
