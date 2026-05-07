package extras

import (
	"github.com/prometheus/client_golang/prometheus"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	ghconnection "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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
	reg prometheus.Registerer,
) []repository.Extra {
	decrypter := repository.ProvideDecrypter(decryptSvc, repository.RegisterDecryptMetrics(reg))
	folderMetadataEnabled := resources.IsFolderMetadataEnabled(cfg)
	return []repository.Extra{
		local.Extra(
			cfg.HomePath,
			cfg.PermittedProvisioningPaths,
		),
		git.Extra(decrypter),
		github.Extra(
			decrypter,
			ghFactory,
			webhooksBuilder,
			repository.NewIncrementalSyncPolicy(folderMetadataEnabled, cfg.ProvisioningMaxIncrementalChanges),
		),
	}
}

func ProvideProvisioningOSSConnectionExtras(
	_ *setting.Cfg,
	decryptSvc decrypt.DecryptService,
	ghFactory ghconnection.GithubFactory,
	reg prometheus.Registerer,
) []connection.Extra {
	decrypter := connection.ProvideDecrypter(decryptSvc, connection.RegisterDecryptMetrics(reg))
	return []connection.Extra{
		ghconnection.Extra(decrypter, ghFactory),
	}
}

func ProvideExtraWorkers(pullRequestWorker *pullrequest.PullRequestWorker) []jobs.Worker {
	return []jobs.Worker{pullRequestWorker}
}

func ProvideFactoryFromConfig(cfg *setting.Cfg, extras []repository.Extra) (repository.Factory, error) {
	types := cfg.ProvisioningRepositoryTypes
	if len(types) == 0 {
		// Enforcing default repository values if settings are not set
		types = []string{"git", "github", "local"}
	}
	enabledTypes := make(map[apisprovisioning.RepositoryType]struct{}, len(types))
	for _, e := range types {
		enabledTypes[apisprovisioning.RepositoryType(e)] = struct{}{}
	}

	return repository.ProvideFactory(enabledTypes, extras)
}

func ProvideQuotaGetter(cfg *setting.Cfg) quotas.QuotaGetter {
	return quotas.NewFixedQuotaGetter(apisprovisioning.QuotaStatus{
		MaxResourcesPerRepository: cfg.ProvisioningMaxResourcesPerRepository,
		MaxRepositories:           cfg.ProvisioningMaxRepositories,
	})
}

func ProvideConnectionFactoryFromConfig(cfg *setting.Cfg, extras []connection.Extra) (connection.Factory, error) {
	types := cfg.ProvisioningRepositoryTypes
	if len(types) == 0 {
		// Enforcing default connection values if settings are not set
		types = []string{"github"}
	}
	enabledTypes := make(map[apisprovisioning.ConnectionType]struct{}, len(types))
	for _, e := range types {
		enabledTypes[apisprovisioning.ConnectionType(e)] = struct{}{}
	}

	return connection.ProvideFactory(enabledTypes, extras)
}
