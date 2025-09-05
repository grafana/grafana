package webhooks

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningapis "github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// WebhookExtraBuilder is a function that returns an ExtraBuilder.
// It is used to add additional functionality for webhooks
type WebhookExtraBuilder struct {
	provisioningapis.ExtraBuilder
	isPublic    bool
	urlProvider func(namespace string) string
}

func (b *WebhookExtraBuilder) WebhookURL(ctx context.Context, r *provisioning.Repository) string {
	if !b.isPublic {
		return ""
	}

	gvr := provisioning.RepositoryResourceInfo.GroupVersionResource()
	webhookURL := fmt.Sprintf(
		"%sapis/%s/%s/namespaces/%s/%s/%s/webhook",
		b.urlProvider(r.GetNamespace()),
		gvr.Group,
		gvr.Version,
		r.GetNamespace(),
		gvr.Resource,
		r.GetName(),
	)

	return webhookURL
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

func ProvideWebhooksWithImages(
	cfg *setting.Cfg,
	renderer rendering.Service,
	blobstore resource.ResourceClient,
	configProvider apiserver.RestConfigProvider,
) *WebhookExtraBuilder {
	urlProvider := func(_ string) string {
		return cfg.AppURL
	}
	isPublic := isPublicURL(urlProvider(""))

	return &WebhookExtraBuilder{
		isPublic:    isPublic,
		urlProvider: urlProvider,
		ExtraBuilder: func(b *provisioningapis.APIBuilder) provisioningapis.Extra {
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

			return NewWebhookExtraWithImages(
				render,
				webhook,
				urlProvider,
				[]jobs.Worker{pullRequestWorker},
			)
		},
	}
}

func ProvideWebhooks(
	cfg *setting.Cfg,
	configProvider apiserver.RestConfigProvider,
) *WebhookExtraBuilder {
	urlProvider := func(_ string) string {
		return cfg.AppURL
	}
	isPublic := isPublicURL(urlProvider(""))

	return &WebhookExtraBuilder{
		isPublic:    isPublic,
		urlProvider: urlProvider,
		ExtraBuilder: func(b *provisioningapis.APIBuilder) provisioningapis.Extra {
			clients := resources.NewClientFactory(configProvider)
			parsers := resources.NewParserFactory(clients)

			screenshotRenderer := pullrequest.NewNoOpRenderer()
			webhook := NewWebhookConnector(
				isPublic,
				b,
				screenshotRenderer,
			)

			evaluator := pullrequest.NewEvaluator(screenshotRenderer, parsers, urlProvider)
			commenter := pullrequest.NewCommenter()
			pullRequestWorker := pullrequest.NewPullRequestWorker(evaluator, commenter)

			return NewWebhookExtra(webhook, []jobs.Worker{pullRequestWorker})
		},
	}
}

// WebhookExtraWithImages implements the Extra interface for webhooks
// to wrap around
type WebhookExtraWithImages struct {
	render  *renderConnector
	webhook *webhookConnector
	workers []jobs.Worker
}

func NewWebhookExtraWithImages(
	render *renderConnector,
	webhook *webhookConnector,
	urlProvider func(namespace string) string,
	workers []jobs.Worker,
) *WebhookExtraWithImages {
	return &WebhookExtraWithImages{
		render:  render,
		webhook: webhook,
		workers: workers,
	}
}

// Authorize delegates authorization to the webhook connector
func (e *WebhookExtraWithImages) Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error) {
	webhookDecision, webhookReason, webhookErr := e.webhook.Authorize(ctx, a)
	if webhookDecision != authorizer.DecisionNoOpinion {
		return webhookDecision, webhookReason, webhookErr
	}

	return e.render.Authorize(ctx, a)
}

// UpdateStorage updates the storage with both render and webhook connectors
func (e *WebhookExtraWithImages) UpdateStorage(storage map[string]rest.Storage) error {
	if err := e.webhook.UpdateStorage(storage); err != nil {
		return err
	}

	return e.render.UpdateStorage(storage)
}

// PostProcessOpenAPI processes OpenAPI specs for both connectors
func (e *WebhookExtraWithImages) PostProcessOpenAPI(oas *spec3.OpenAPI) error {
	if err := e.webhook.PostProcessOpenAPI(oas); err != nil {
		return err
	}

	return e.render.PostProcessOpenAPI(oas)
}

// GetJobWorkers returns job workers from the webhook connector
func (e *WebhookExtraWithImages) GetJobWorkers() []jobs.Worker {
	return e.workers
}

type WebhookExtra struct {
	webhook *webhookConnector
	workers []jobs.Worker
}

func NewWebhookExtra(
	webhook *webhookConnector,
	workers []jobs.Worker,
) *WebhookExtra {
	return &WebhookExtra{
		webhook: webhook,
		workers: workers,
	}
}

// Authorize delegates authorization to the webhook connector
func (e *WebhookExtra) Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error) {
	return e.webhook.Authorize(ctx, a)
}

// UpdateStorage updates the storage with webhook connector
func (e *WebhookExtra) UpdateStorage(storage map[string]rest.Storage) error {
	return e.webhook.UpdateStorage(storage)
}

// PostProcessOpenAPI processes OpenAPI specs for webhook connectors
func (e *WebhookExtra) PostProcessOpenAPI(oas *spec3.OpenAPI) error {
	return e.webhook.PostProcessOpenAPI(oas)
}

// GetJobWorkers returns job workers from the webhook connector
func (e *WebhookExtra) GetJobWorkers() []jobs.Worker {
	return e.workers
}
