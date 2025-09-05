package extras

import (
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// HACK: This is a hack so that wire can uniquely identify dependencies
func ProvideProvisioningOSSExtras(webhook *webhooks.WebhookExtraBuilder) []provisioning.ExtraBuilder {
	return []provisioning.ExtraBuilder{
		webhook.ExtraBuilder,
	}
}

func ProvideProvisioningOSSRepositoryExtras(
	cfg *setting.Cfg,
	decryptSvc decrypt.DecryptService,
	ghFactory *github.Factory,
	webhooksBuilder *webhooks.WebhookExtraBuilder,
) []repository.Extra {
	return []repository.Extra{
		local.Extra(
			cfg.HomePath,
			cfg.PermittedProvisioningPaths,
		),
		github.Extra(
			repository.ProvideDecrypter(decryptSvc),
			ghFactory,
			webhooksBuilder,
		),
	}
}

func ProvideExtraWorkers(
	cfg *setting.Cfg,
	renderer rendering.Service,
	blobstore resource.ResourceClient,
	configProvider apiserver.RestConfigProvider,
) []jobs.Worker {
	urlProvider := func(_ string) string {
		return cfg.AppURL
	}

	clients := resources.NewClientFactory(configProvider)
	parsers := resources.NewParserFactory(clients)
	screenshotRenderer := pullrequest.NewScreenshotRenderer(renderer, blobstore)

	evaluator := pullrequest.NewEvaluator(screenshotRenderer, parsers, urlProvider)
	commenter := pullrequest.NewCommenter()
	pullRequestWorker := pullrequest.NewPullRequestWorker(evaluator, commenter)

	return []jobs.Worker{pullRequestWorker}
}
