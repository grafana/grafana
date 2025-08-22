package git

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
)

type extra struct {
	secrets secrets.RepositorySecrets
}

func Extra(secrets secrets.RepositorySecrets) repository.Extra {
	return &extra{secrets: secrets}
}

func (e *extra) Type() provisioning.RepositoryType {
	return provisioning.GitHubRepositoryType
}

func (e *extra) Build(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	// Decrypt token if needed
	token := r.Spec.Git.Token
	if token == "" && len(r.Spec.Git.EncryptedToken) > 0 {
		decrypted, err := e.secrets.Decrypt(ctx, r, string(r.Spec.Git.EncryptedToken))
		if err != nil {
			return nil, fmt.Errorf("decrypt git token: %w", err)
		}
		token = string(decrypted)
	}

	cfg := RepositoryConfig{
		URL:            r.Spec.Git.URL,
		Branch:         r.Spec.Git.Branch,
		Path:           r.Spec.Git.Path,
		TokenUser:      r.Spec.Git.TokenUser,
		Token:          token,
		EncryptedToken: r.Spec.Git.EncryptedToken,
	}
	return NewGitRepository(ctx, r, cfg, e.secrets)
}
