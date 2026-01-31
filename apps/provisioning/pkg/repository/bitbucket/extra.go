package bitbucket

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
)

type extra struct {
	decrypter repository.Decrypter
}

func Extra(decrypter repository.Decrypter) repository.Extra {
	return &extra{
		decrypter: decrypter,
	}
}

func (e *extra) Type() provisioning.RepositoryType {
	return provisioning.BitbucketRepositoryType
}

func (e *extra) Build(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	if r == nil || r.Spec.Bitbucket == nil {
		return nil, fmt.Errorf("bitbucket configuration is required")
	}

	cfg := r.Spec.Bitbucket
	logger := logging.FromContext(ctx).With("url", cfg.URL, "branch", cfg.Branch, "path", cfg.Path)
	logger.Info("Instantiating Bitbucket repository")

	secure := e.decrypter(r)
	token, err := secure.Token(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to decrypt token: %w", err)
	}

	// Bitbucket uses the same Git protocol with HTTP Basic Auth, so we reuse git.Repository.
	// TokenUser should be the user's email for Atlassian API tokens, or "x-token-auth" for Repository Access Tokens.
	return git.NewRepository(ctx, r, git.RepositoryConfig{
		URL:       cfg.URL,
		Branch:    cfg.Branch,
		Path:      cfg.Path,
		TokenUser: cfg.TokenUser,
		Token:     token,
	})
}

func (e *extra) Mutate(ctx context.Context, obj runtime.Object) error {
	return Mutate(ctx, obj)
}

func (e *extra) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return Validate(ctx, obj)
}
