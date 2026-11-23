package git

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/utils/ptr"
)

type extra struct {
	decrypter repository.Decrypter
	// allowInsecure permits http:// URLs together with a token (cleartext credentials); local/dev only.
	allowInsecure bool
	metrics       *repository.OperationMetrics
	clientMetrics *ClientMetrics
	userAgent     string
}

func Extra(decrypter repository.Decrypter, allowInsecure bool, metrics *repository.OperationMetrics, clientMetrics *ClientMetrics, userAgent string) repository.Extra {
	return &extra{
		decrypter:     decrypter,
		allowInsecure: allowInsecure,
		metrics:       metrics,
		clientMetrics: clientMetrics,
		userAgent:     userAgent,
	}
}

func (e *extra) Type() provisioning.RepositorySpecType {
	return provisioning.RepositorySpecTypeGit
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
		URL:              ptr.Deref(cfg.Url, ""),
		Branch:           cfg.Branch,
		Path:             ptr.Deref(cfg.Path, ""),
		TokenUser:        ptr.Deref(cfg.TokenUser, ""),
		Token:            token,
		CommitSigningKey: signingKey,
		SigningMethod:    SigningMethodFromSpec(r),
		SMIMECertificate: SMIMECertificateFromSpec(r),
		SkipGitSuffix:    true,
		UserAgent:        e.userAgent,
	}, e.metrics, e.clientMetrics)
}

func (e *extra) Mutate(ctx context.Context, obj runtime.Object, oldObj runtime.Object) error {
	return Mutate(ctx, obj)
}

func (e *extra) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return Validate(ctx, obj, e.allowInsecure)
}
