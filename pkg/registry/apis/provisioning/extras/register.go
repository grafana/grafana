package extras

import (
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/grafana/grafana/pkg/setting"
)

// HACK: This is a hack so that wire can uniquely identify dependencies
func ProvideProvisioningExtraAPIs(webhook *webhooks.WebhookExtraBuilder) []provisioning.ExtraBuilder {
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

func ProvideExtraWorkers(pullRequestWorker *pullrequest.PullRequestWorker) []jobs.Worker {
	return []jobs.Worker{pullRequestWorker}
}
