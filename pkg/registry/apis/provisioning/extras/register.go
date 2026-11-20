package extras

import (
	"slices"

	"github.com/prometheus/client_golang/prometheus"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	ghconnection "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/githuboauth"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/gitoauth"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/bootstrap"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	secretcontracts "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
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
	secureValues secretcontracts.SecureValueClient,
) []repository.Extra {
	// HACK: OSS serves no secrets API, so provisioning addresses secure values through the
	// in-process client. It is registered from here because this is the OSS-only provisioning
	// wiring, and it runs before the API builder exists.
	provisioning.ServeSecureValuesInProcess(secureValues)

	decrypter := repository.ProvideDecrypter(decryptSvc, repository.RegisterDecryptMetrics(reg))
	operationMetrics := repository.RegisterOperationMetrics(reg)
	clientMetrics := git.RegisterClientMetrics(reg)
	resources.RegisterFolderMetadataMetrics(reg)
	// http:// URLs with a token are only allowed in development or when explicitly opted in,
	// since the token would otherwise travel in cleartext.
	allowInsecure := cfg.Env == setting.Dev || cfg.ProvisioningAllowInsecure
	userAgent := git.UserAgent(cfg.BuildVersion)
	return []repository.Extra{
		local.Extra(
			cfg.HomePath,
			PermittedLocalPaths(cfg),
			operationMetrics,
		),
		git.Extra(decrypter, allowInsecure, operationMetrics, clientMetrics, userAgent),
		github.Extra(
			decrypter,
			ghFactory,
			webhooksBuilder,
			allowInsecure,
			operationMetrics,
			clientMetrics,
			userAgent,
		),
	}
}

// PermittedLocalPaths returns the prefixes a local repository may read. Being configured is
// what permits the bootstrap path, since Grafana registers that repository itself.
func PermittedLocalPaths(cfg *setting.Cfg) []string {
	if cfg.ProvisioningBootstrapPath == "" {
		return cfg.PermittedProvisioningPaths
	}
	// A value admission would reject is not granted either.
	if bootstrap.ValidatePath(cfg.ProvisioningBootstrapPath) != nil {
		return cfg.PermittedProvisioningPaths
	}
	// Resolved by the resolver's own helper, so the prefix and the candidate admission
	// matches against it are the same string.
	permitted := local.ResolvePath(cfg.HomePath, cfg.ProvisioningBootstrapPath)
	return append(slices.Clone(cfg.PermittedProvisioningPaths), permitted)
}

func ProvideProvisioningOSSConnectionExtras(
	cfg *setting.Cfg,
	decryptSvc decrypt.DecryptService,
	ghFactory ghconnection.GithubFactory,
	ghRepoFactory *github.Factory,
	reg prometheus.Registerer,
) []connection.Extra {
	decrypter := connection.ProvideDecrypter(decryptSvc, connection.RegisterDecryptMetrics(reg))
	return []connection.Extra{
		ghconnection.Extra(decrypter, ghFactory),
		githuboauth.Extra(decrypter, ghRepoFactory),
		// http:// OAuth endpoints are only allowed in development or when explicitly opted in,
		// since the client secret and tokens would otherwise travel in cleartext.
		gitoauth.Extra(decrypter, cfg.Env == setting.Dev || cfg.ProvisioningAllowInsecure),
	}
}

func ProvideExtraWorkers(pullRequestWorker *pullrequest.PullRequestWorker) []jobs.Worker {
	return []jobs.Worker{pullRequestWorker}
}

func ProvideFactoryFromConfig(cfg *setting.Cfg, tracer tracing.Tracer, extras []repository.Extra) (repository.Factory, error) {
	types := cfg.ProvisioningRepositoryTypes
	if len(types) == 0 {
		// Enforcing default repository values if settings are not set
		types = []string{"git", "github", "local"}
	}
	enabledTypes := make(map[apisprovisioning.RepositoryType]struct{}, len(types))
	for _, e := range types {
		enabledTypes[apisprovisioning.RepositoryType(e)] = struct{}{}
	}

	return repository.ProvideFactory(enabledTypes, extras, tracer)
}

func ProvideQuotaGetter(cfg *setting.Cfg) quotas.QuotaGetter {
	return quotas.NewFixedQuotaGetter(apisprovisioning.QuotaStatus{
		MaxResourcesPerRepository: cfg.ProvisioningMaxResourcesPerRepository,
		MaxRepositories:           cfg.ProvisioningMaxRepositories,
	})
}

func ProvideConnectionFactoryFromConfig(cfg *setting.Cfg, tracer tracing.Tracer, extras []connection.Extra) (connection.Factory, error) {
	types := cfg.ProvisioningConnectionTypes
	if len(types) == 0 {
		// Enforcing default connection values if settings are not set
		types = []string{string(apisprovisioning.GithubConnectionType)}
	}

	return connection.ProvideFactory(connection.ToConnectionTypes(types), extras, tracer)
}
