package git

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	commonMeta "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
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
	return provisioning.GitHubRepositoryType
}

func (e *extra) Build(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
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

	cfg := RepositoryConfig{
		URL:       r.Spec.Git.URL,
		Branch:    r.Spec.Git.Branch,
		Path:      r.Spec.Git.Path,
		TokenUser: r.Spec.Git.TokenUser,
		Token:     token,
	}

	return NewGitRepository(ctx, r, cfg)
}

func (e *extra) Mutate(ctx context.Context, obj runtime.Object) error {
	return Mutate(ctx, obj)
}
