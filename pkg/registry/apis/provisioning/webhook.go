package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/pullrequest"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	gogit "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/go-git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/services/apiserver"
	grafanasecrets "github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

// Webhook endpoint max size (25MB)
// See https://docs.github.com/en/webhooks/webhook-events-and-payloads
const webhookMaxBodySize = 25 * 1024 * 1024

// WebhookExtraBuilder is a function that returns an ExtraBuilder.
// It is used to add additional functionality for webhooks
type WebhookExtraBuilder struct {
	// HACK: We need to wrap the builder to please wire so that it can uniquely identify the dependency
	ExtraBuilder
}

func ProvideWebhooks(
	cfg *setting.Cfg,
	// FIXME: use multi-tenant service when one exists. In this state, we can't make this a multi-tenant service!
	secretsSvc grafanasecrets.Service,
	ghFactory *github.Factory,
	renderer pullrequest.ScreenshotRenderer,
	configProvider apiserver.RestConfigProvider,
) WebhookExtraBuilder {
	urlProvider := func(namespace string) string {
		return cfg.AppURL
	}
	// HACK: Assume is only public if it is HTTPS
	isPublic := strings.HasPrefix(urlProvider(""), "https://")
	clients := resources.NewClientFactory(configProvider)
	parsers := resources.NewParserFactory(clients)

	return WebhookExtraBuilder{
		ExtraBuilder: func(b *APIBuilder) Extra {
			return NewWebhookConnector(
				b,
				b,
				b,
				isPublic,
				urlProvider,
				b,
				secrets.NewSingleTenant(secretsSvc),
				ghFactory,
				renderer,
				parsers,
			)
		},
	}
}

// This only works for github right now
type webhookConnector struct {
	client          ClientGetter
	getter          RepoGetter
	jobs            JobQueueGetter
	webhooksEnabled bool
	urlProvider     func(namespace string) string
	apiBuilder      *APIBuilder
	secrets         secrets.Service
	ghFactory       *github.Factory
	renderer        pullrequest.ScreenshotRenderer
	parsers         resources.ParserFactory
}

type JobQueueGetter interface {
	GetJobQueue() jobs.Queue
}

func NewWebhookConnector(
	client ClientGetter,
	getter RepoGetter,
	jobs JobQueueGetter,
	webhooksEnabled bool,
	urlProvider func(namespace string) string,
	apiBuilder *APIBuilder,
	secrets secrets.Service,
	ghFactory *github.Factory,
	renderer pullrequest.ScreenshotRenderer,
	parsers resources.ParserFactory,
) *webhookConnector {
	return &webhookConnector{
		client:          client,
		getter:          getter,
		jobs:            jobs,
		webhooksEnabled: webhooksEnabled,
		urlProvider:     urlProvider,
		apiBuilder:      apiBuilder,
		secrets:         secrets,
		ghFactory:       ghFactory,
		renderer:        renderer,
		parsers:         parsers,
	}
}

func (*webhookConnector) New() runtime.Object {
	return &provisioning.WebhookResponse{}
}

func (*webhookConnector) Destroy() {}

func (*webhookConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*webhookConnector) ProducesObject(verb string) any {
	return &provisioning.WebhookResponse{}
}

func (*webhookConnector) ConnectMethods() []string {
	return []string{
		http.MethodPost,
		http.MethodGet, // only useful for browser testing, should be removed
	}
}

func (*webhookConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *webhookConnector) Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error) {
	if provisioning.RepositoryResourceInfo.GetName() == a.GetResource() && a.GetSubresource() == "webhook" {
		// When the resource is a webhook, we'll deal with permissions manually by checking signatures or similar in the webhook handler.
		// The user in this context is usually an anonymous user, but may also be an authenticated synthetic check by the Grafana instance's operator as well.
		// For context on the anonymous user, check the authn/clients/provisioning.go file.
		return authorizer.DecisionAllow, "", nil
	}

	return authorizer.DecisionNoOpinion, "", nil
}

func (s *webhookConnector) UpdateStorage(storage map[string]rest.Storage) error {
	storage[provisioning.RepositoryResourceInfo.StoragePath("webhook")] = s
	return nil
}

func (s *webhookConnector) GetJobWorkers() []jobs.Worker {
	evaluator := pullrequest.NewEvaluator(s.renderer, s.parsers, s.urlProvider)
	commenter := pullrequest.NewCommenter()
	pullRequestWorker := pullrequest.NewPullRequestWorker(evaluator, commenter)

	return []jobs.Worker{pullRequestWorker}
}

func (s *webhookConnector) AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	if r.Spec.Type == provisioning.GitHubRepositoryType {
		gvr := provisioning.RepositoryResourceInfo.GroupVersionResource()
		webhookURL := fmt.Sprintf(
			"%sapis/%s/%s/namespaces/%s/%s/%s/webhook",
			s.urlProvider(r.GetNamespace()),
			gvr.Group,
			gvr.Version,
			r.GetNamespace(),
			gvr.Resource,
			r.GetName(),
		)
		cloneFn := func(ctx context.Context, opts repository.CloneOptions) (repository.ClonedRepository, error) {
			// TODO: Do not use builder private
			return gogit.Clone(ctx, s.apiBuilder.clonedir, r, opts, s.secrets)
		}

		return repository.NewGitHub(ctx, r, s.ghFactory, s.secrets, webhookURL, cloneFn)
	}

	return nil, nil
}

func (s *webhookConnector) Mutate(ctx context.Context, r *provisioning.Repository) error {
	// Encrypt webhook secret if present
	if r.Status.Webhook != nil && r.Status.Webhook.Secret != "" {
		encryptedSecret, err := s.secrets.Encrypt(ctx, []byte(r.Status.Webhook.Secret))
		if err != nil {
			return fmt.Errorf("failed to encrypt webhook secret: %w", err)
		}
		r.Status.Webhook.EncryptedSecret = encryptedSecret
		r.Status.Webhook.Secret = ""
	}

	return nil
}

func (s *webhookConnector) PostProcessOpenAPI(oas *spec3.OpenAPI) error {
	repoprefix := provisioning.RepositoryResourceInfo.GetName() + "/"
	sub := oas.Paths.Paths[repoprefix+"/webhook"]
	if sub != nil && sub.Get != nil {
		sub.Post.Description = "Currently only supports github webhooks"
	}

	return nil
}

func (s *webhookConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	namespace := request.NamespaceValue(ctx)
	ctx, _, err := identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		return nil, err
	}

	// Get the repository with the worker identity (since the request user is likely anonymous)
	repo, err := s.getter.GetHealthyRepository(ctx, name)
	if err != nil {
		return nil, err
	}

	return withTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := logging.FromContext(r.Context()).With("logger", "webhook-connector", "repo", name)
		ctx := logging.Context(r.Context(), logger)
		if !s.webhooksEnabled {
			responder.Error(errors.NewBadRequest("webhooks are not enabled"))
			return
		}

		hooks, ok := repo.(repository.Hooks)
		if !ok {
			responder.Error(errors.NewBadRequest("the repository does not support webhooks"))
			return
		}

		// Limit the webhook request body size
		r.Body = http.MaxBytesReader(w, r.Body, webhookMaxBodySize)

		rsp, err := hooks.Webhook(ctx, r)
		if err != nil {
			responder.Error(err)
			return
		}

		if rsp == nil {
			responder.Error(fmt.Errorf("expecting a response"))
			return
		}

		if err := s.updateLastEvent(ctx, repo, name, namespace); err != nil {
			// Continue processing as this is non-critical; the update is purely informational
			logger.Error("failed to update last event", "error", err)
		}

		if rsp.Job != nil {
			rsp.Job.Repository = name
			job, err := s.jobs.GetJobQueue().Insert(ctx, namespace, *rsp.Job)
			if err != nil {
				responder.Error(err)
				return
			}
			responder.Object(rsp.Code, job)
			return
		}

		responder.Object(rsp.Code, rsp)
	}), 30*time.Second), nil
}

// updateLastEvent updates the last event time for the webhook
// This is to provide some visibility that the webhook is still active and working
// It's not a good idea to update the webhook status too often, so we only update it if it's been a while
func (s *webhookConnector) updateLastEvent(ctx context.Context, repo repository.Repository, name, namespace string) error {
	client := s.client.GetClient()
	if client == nil {
		// This would only happen if we wired things up incorrectly
		return fmt.Errorf("client is nil")
	}

	lastEvent := time.UnixMilli(repo.Config().Status.Webhook.LastEvent)
	eventAge := time.Since(lastEvent)

	if repo.Config().Status.Webhook != nil && (eventAge > time.Minute) {
		patchOp := map[string]interface{}{
			"op":    "replace",
			"path":  "/status/webhook/lastEvent",
			"value": time.Now().UnixMilli(),
		}

		patch, err := json.Marshal([]map[string]interface{}{patchOp})
		if err != nil {
			return fmt.Errorf("marshal patch: %w", err)
		}

		if _, err = client.Repositories(namespace).
			Patch(ctx, name, types.JSONPatchType, patch, metav1.PatchOptions{}, "status"); err != nil {
			return fmt.Errorf("patch status: %w", err)
		}
	}

	return nil
}

var (
	_ rest.Storage         = (*webhookConnector)(nil)
	_ rest.Connecter       = (*webhookConnector)(nil)
	_ rest.StorageMetadata = (*webhookConnector)(nil)
)
