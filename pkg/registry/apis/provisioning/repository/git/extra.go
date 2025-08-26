package git

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"k8s.io/apimachinery/pkg/runtime"
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
	return provisioning.GitRepositoryType
}

func (e *extra) Build(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	secure := e.decrypter(r)
	cfg := r.Spec.Git
	if cfg == nil {
		return nil, fmt.Errorf("git configuration is required")
	}

	token, err := secure.Token(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to decrypt token: %w", err)
	}

	return NewRepository(ctx, r, RepositoryConfig{
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
