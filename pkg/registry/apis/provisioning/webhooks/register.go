package webhooks

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningapis "github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// WebhookExtraBuilder is a function that returns an ExtraBuilder.
// It is used to add additional functionality for webhooks
type WebhookExtraBuilder struct {
	// HACK: We need to wrap the builder to please wire so that it can uniquely identify the dependency
	provisioningapis.ExtraBuilder
}

// HACK: assume that the URL is public if it starts with "https://" and does not contain any local IP ranges
func isPublicURL(url string) bool {
	return strings.HasPrefix(url, "https://") &&
		!strings.Contains(url, "localhost") &&
		!strings.HasPrefix(url, "https://127.") &&
		!strings.HasPrefix(url, "https://192.") &&
		!strings.HasPrefix(url, "https://10.") &&
		!strings.HasPrefix(url, "https://172.16.")
}

func ProvideWebhooks(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	repositorySecrets secrets.RepositorySecrets,
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

			isPublic := isPublicURL(urlProvider(""))
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
				render,
				webhook,
				urlProvider,
				repositorySecrets,
				ghFactory,
				parsers,
				[]jobs.Worker{pullRequestWorker},
				isPublic, // Pass the public URL flag
			)
		},
	}
}

// WebhookExtra implements the Extra interface for webhooks
// to wrap around
type WebhookExtra struct {
	render      *renderConnector
	webhook     *webhookConnector
	urlProvider func(namespace string) string
	secrets     secrets.RepositorySecrets
	ghFactory   *github.Factory
	parsers     resources.ParserFactory
	workers     []jobs.Worker
	isPublic    bool // Flag to determine if webhook-enhanced repositories should be created
}

func NewWebhookExtra(
	render *renderConnector,
	webhook *webhookConnector,
	urlProvider func(namespace string) string,
	secrets secrets.RepositorySecrets,
	ghFactory *github.Factory,
	parsers resources.ParserFactory,
	workers []jobs.Worker,
	isPublic bool,
) *WebhookExtra {
	return &WebhookExtra{
		render:      render,
		webhook:     webhook,
		urlProvider: urlProvider,
		secrets:     secrets,
		ghFactory:   ghFactory,
		parsers:     parsers,
		workers:     workers,
		isPublic:    isPublic,
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

// Mutators returns the mutators for the webhook extra
func (e *WebhookExtra) Mutators() []controller.Mutator {
	return []controller.Mutator{
		Mutator(e.secrets),
	}
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
	// TODO: Convert to extra
	// Only handle GitHub repositories with webhooks if URL is public
	if r.Spec.Type == provisioning.GitHubRepositoryType && e.isPublic {
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

		basicRepo, err := github.NewGitHub(ctx, r, gitRepo, e.ghFactory, ghToken, e.secrets)
		if err != nil {
			return nil, fmt.Errorf("error creating github repository: %w", err)
		}

		return NewGithubWebhookRepository(basicRepo, webhookURL, e.secrets), nil
	}

	return nil, nil
}

func (e *WebhookExtra) RepositoryTypes() []provisioning.RepositoryType {
	// Only claim to handle GitHub repositories if URL is public
	if e.isPublic {
		return []provisioning.RepositoryType{
			provisioning.GitHubRepositoryType,
		}
	}
	return []provisioning.RepositoryType{}
}
