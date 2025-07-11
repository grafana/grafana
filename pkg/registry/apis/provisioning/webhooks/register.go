package webhooks

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	provisioningapis "github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/rendering"
	grafanasecrets "github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"
)

// WebhookExtraBuilder is a function that returns an ExtraBuilder.
// It is used to add additional functionality for webhooks
type WebhookExtraBuilder struct {
	// HACK: We need to wrap the builder to please wire so that it can uniquely identify the dependency
	provisioningapis.ExtraBuilder
}

func ProvideWebhooks(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	// FIXME: use multi-tenant service when one exists. In this state, we can't make this a multi-tenant service!
	secretsSvc grafanasecrets.Service,
	ghFactory *github.Factory,
	renderer rendering.Service,
	blobstore resource.ResourceClient,
	configProvider apiserver.RestConfigProvider,
) WebhookExtraBuilder {
	return WebhookExtraBuilder{
		ExtraBuilder: func(b *provisioningapis.APIBuilder) provisioningapis.Extra {
			urlProvider := func(_ string) string {
				return cfg.AppURL
			}
			// HACK: Assume is only public if it is HTTPS
			isPublic := strings.HasPrefix(urlProvider(""), "https://")
			clients := resources.NewClientFactory(configProvider)
			parsers := resources.NewParserFactory(clients)

			screenshotRenderer := pullrequest.NewScreenshotRenderer(renderer, blobstore)
			render := NewRenderConnector(blobstore, b)
			webhook := NewWebhookConnector(
				isPublic,
				b,
				screenshotRenderer,
			)

			evaluator := pullrequest.NewEvaluator(screenshotRenderer, parsers, urlProvider)
			commenter := pullrequest.NewCommenter()
			pullRequestWorker := pullrequest.NewPullRequestWorker(evaluator, commenter)

			return NewWebhookExtra(
				features,
				render,
				webhook,
				urlProvider,
				secrets.NewSingleTenant(secretsSvc),
				ghFactory,
				filepath.Join(cfg.DataPath, "clone"),
				parsers,
				[]jobs.Worker{pullRequestWorker},
			)
		},
	}
}

// WebhookExtra implements the Extra interface for webhooks
// to wrap around
type WebhookExtra struct {
	features    featuremgmt.FeatureToggles
	render      *renderConnector
	webhook     *webhookConnector
	urlProvider func(namespace string) string
	secrets     secrets.Service
	ghFactory   *github.Factory
	clonedir    string
	parsers     resources.ParserFactory
	workers     []jobs.Worker
}

func NewWebhookExtra(
	features featuremgmt.FeatureToggles,
	render *renderConnector,
	webhook *webhookConnector,
	urlProvider func(namespace string) string,
	secrets secrets.Service,
	ghFactory *github.Factory,
	clonedir string,
	parsers resources.ParserFactory,
	workers []jobs.Worker,
) *WebhookExtra {
	return &WebhookExtra{
		features:    features,
		render:      render,
		webhook:     webhook,
		urlProvider: urlProvider,
		secrets:     secrets,
		ghFactory:   ghFactory,
		clonedir:    clonedir,
		parsers:     parsers,
		workers:     workers,
	}
}

// Authorize delegates authorization to the webhook connector
func (e *WebhookExtra) Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error) {
	webhookDecision, webhookReason, webhookErr := e.webhook.Authorize(ctx, a)
	if webhookDecision != authorizer.DecisionNoOpinion {
		return webhookDecision, webhookReason, webhookErr
	}

	return e.render.Authorize(ctx, a)
}

// Mutate delegates mutation to the webhook connector
func (e *WebhookExtra) Mutate(ctx context.Context, r *provisioning.Repository) error {
	// Encrypt webhook secret if present
	if r.Status.Webhook != nil && r.Status.Webhook.Secret != "" {
		encryptedSecret, err := e.secrets.Encrypt(ctx, []byte(r.Status.Webhook.Secret))
		if err != nil {
			return fmt.Errorf("failed to encrypt webhook secret: %w", err)
		}
		r.Status.Webhook.EncryptedSecret = encryptedSecret
		r.Status.Webhook.Secret = ""
	}

	return nil
}

// UpdateStorage updates the storage with both render and webhook connectors
func (e *WebhookExtra) UpdateStorage(storage map[string]rest.Storage) error {
	if err := e.webhook.UpdateStorage(storage); err != nil {
		return err
	}
	return e.render.UpdateStorage(storage)
}

// PostProcessOpenAPI processes OpenAPI specs for both connectors
func (e *WebhookExtra) PostProcessOpenAPI(oas *spec3.OpenAPI) error {
	if err := e.webhook.PostProcessOpenAPI(oas); err != nil {
		return err
	}

	return e.render.PostProcessOpenAPI(oas)
}

// GetJobWorkers returns job workers from the webhook connector
func (e *WebhookExtra) GetJobWorkers() []jobs.Worker {
	return e.workers
}

// AsRepository delegates repository creation to the webhook connector
func (e *WebhookExtra) AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	if r.Spec.Type == provisioning.GitHubRepositoryType {
		gvr := provisioning.RepositoryResourceInfo.GroupVersionResource()
		webhookURL := fmt.Sprintf(
			"%sapis/%s/%s/namespaces/%s/%s/%s/webhook",
			e.urlProvider(r.GetNamespace()),
			gvr.Group,
			gvr.Version,
			r.GetNamespace(),
			gvr.Resource,
			r.GetName(),
		)

		logger := logging.FromContext(ctx).With("url", r.Spec.GitHub.URL, "branch", r.Spec.GitHub.Branch, "path", r.Spec.GitHub.Path)
		logger.Info("Instantiating Github repository with webhooks")
		ghCfg := r.Spec.GitHub
		if ghCfg == nil {
			return nil, fmt.Errorf("github configuration is required for nano git")
		}

		// Decrypt GitHub token if needed
		ghToken := ghCfg.Token
		if ghToken == "" && len(ghCfg.EncryptedToken) > 0 {
			decrypted, err := e.secrets.Decrypt(ctx, ghCfg.EncryptedToken)
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

		gitRepo, err := git.NewGitRepository(ctx, r, gitCfg)
		if err != nil {
			return nil, fmt.Errorf("error creating git repository: %w", err)
		}

		basicRepo, err := github.NewGitHub(ctx, r, gitRepo, e.ghFactory, ghToken)
		if err != nil {
			return nil, fmt.Errorf("error creating github repository: %w", err)
		}

		return NewGithubWebhookRepository(basicRepo, webhookURL, e.secrets), nil
	}

	return nil, nil
}
