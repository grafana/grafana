package github

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	"github.com/grafana/grafana/apps/provisioning/pkg/util"
)

//go:generate mockery --name WebhookURLBuilder --structname MockWebhookURLBuilder --inpackage --filename webhook_builder_mock.go --with-expecter
type WebhookURLBuilder interface {
	WebhookURL(ctx context.Context, r *provisioning.Repository) string
}

type extra struct {
	factory        *Factory
	decrypter      repository.Decrypter
	webhookBuilder WebhookURLBuilder
	// allowInsecure permits http:// URLs together with a token (cleartext credentials); local/dev only.
	allowInsecure bool
	// limits caps, in bytes, the git response sizes read from the repository.
	limits git.Limits
}

func Extra(decrypter repository.Decrypter, factory *Factory, webhookBuilder WebhookURLBuilder, allowInsecure bool, limits git.Limits) repository.Extra {
	return &extra{
		decrypter:      decrypter,
		factory:        factory,
		webhookBuilder: webhookBuilder,
		allowInsecure:  allowInsecure,
		limits:         limits,
	}
}

func (e *extra) Type() provisioning.RepositoryType {
	return provisioning.GitHubRepositoryType
}

func (e *extra) Build(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	if r == nil || r.Spec.GitHub == nil {
		return nil, fmt.Errorf("github configuration is required")
	}
	logger := logging.FromContext(ctx).With("url", r.Spec.GitHub.URL, "branch", r.Spec.GitHub.Branch, "path", r.Spec.GitHub.Path)
	logger.Info("Instantiating Github repository")

	secure := e.decrypter(r)
	token, err := secure.Token(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to decrypt token: %w", err)
	}

	signingKey, err := secure.CommitSigningKey(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to decrypt signing key: %w", err)
	}

	gitRepo, err := git.NewRepository(ctx, r, git.RepositoryConfig{
		URL:              r.Spec.GitHub.URL,
		Branch:           r.Spec.GitHub.Branch,
		Path:             r.Spec.GitHub.Path,
		Token:            token,
		CommitSigningKey: signingKey,
		SigningMethod:    git.SigningMethodFromSpec(r),
		SMIMECertificate: git.SMIMECertificateFromSpec(r),
		Limits:           e.limits,
	})
	if err != nil {
		return nil, fmt.Errorf("error creating git repository: %w", err)
	}

	ghRepo, err := NewRepository(ctx, r, gitRepo, e.factory, token)
	if err != nil {
		return nil, fmt.Errorf("error creating github repository: %w", err)
	}

	return MaybeWrapWithWebhook(ctx, r, ghRepo, secure, e.webhookBuilder)
}

// MaybeWrapWithWebhook wraps base as a webhook-capable repository when a webhook
// URL is configured and enabled; otherwise it returns base unchanged. When the
// webhook is disabled but a previously registered hook still exists, base is
// wrapped with empty credentials so the reconciler can delete the stale hook.
func MaybeWrapWithWebhook(
	ctx context.Context,
	r *provisioning.Repository,
	base GithubRepository,
	secure repository.SecureValues,
	webhookBuilder WebhookURLBuilder,
) (repository.Repository, error) {
	if util.IsInterfaceNil(webhookBuilder) {
		return base, nil
	}
	logger := logging.FromContext(ctx)

	// Webhook integration is explicitly disabled for this repository, so polling will be
	// used instead. Skip registration even if a webhook URL would otherwise be available.
	// If there is a webhook already registered from a previous enabled state, wrap with
	// GithubWebhookRepository anyway so OnUpdate can delete the stale hook from GitHub.
	if r.Spec.Webhook != nil && r.Spec.Webhook.Disabled {
		if repository.GetID(r.Status.Webhook).IsEmpty() {
			logger.Debug("Skipping webhook setup: webhook is disabled")
			return base, nil
		}
		return NewGithubWebhookRepository(base, "", ""), nil
	}

	webhookURL := webhookBuilder.WebhookURL(ctx, r)
	if len(webhookURL) == 0 {
		logger.Debug("Skipping webhook setup as no webhooks are not configured")
		return base, nil
	}

	webhookSecret, err := secure.WebhookSecret(ctx)
	if err != nil {
		return nil, fmt.Errorf("decrypt webhookSecret: %w", err)
	}

	return NewGithubWebhookRepository(base, webhookURL, webhookSecret), nil
}

func (e *extra) Mutate(ctx context.Context, obj runtime.Object) error {
	return Mutate(ctx, obj)
}

func (e *extra) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return Validate(ctx, obj, e.allowInsecure)
}
