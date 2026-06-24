package git

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

type extra struct {
	decrypter repository.Decrypter
	// allowInsecure permits http:// URLs together with a token (cleartext credentials); local/dev only.
	allowInsecure bool
	// maxFileSize caps, in bytes, the size of a single file read from the
	// repository. 0 means unlimited.
	maxFileSize int64
}

func Extra(decrypter repository.Decrypter, allowInsecure bool, maxFileSize int64) repository.Extra {
	return &extra{
		decrypter:     decrypter,
		allowInsecure: allowInsecure,
		maxFileSize:   maxFileSize,
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

	signingKey, err := secure.CommitSigningKey(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to decrypt signing key: %w", err)
	}

	return NewRepository(ctx, r, RepositoryConfig{
		URL:              cfg.URL,
		Branch:           cfg.Branch,
		Path:             cfg.Path,
		TokenUser:        cfg.TokenUser,
		Token:            token,
		CommitSigningKey: signingKey,
		SigningMethod:    SigningMethodFromSpec(r),
		SMIMECertificate: SMIMECertificateFromSpec(r),
		SkipGitSuffix:    true,
		MaxFileSize:      e.maxFileSize,
	})
}

func (e *extra) Mutate(ctx context.Context, obj runtime.Object) error {
	return Mutate(ctx, obj)
}

func (e *extra) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return Validate(ctx, obj, e.allowInsecure)
}
