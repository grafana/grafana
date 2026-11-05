package extras

import (
	"path/filepath"
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

// PermittedLocalPaths returns the prefixes a local repository may read. The bootstrap
// path is permitted on the strength of being configured: Grafana registers the repository
// over it itself, so requiring it in permitted_provisioning_paths as well would only fail
// the bootstrap at admission with nothing for an operator to act on.
func PermittedLocalPaths(cfg *setting.Cfg) []string {
	if cfg.ProvisioningBootstrapPath == "" {
		return cfg.PermittedProvisioningPaths
	}
	// The prefixes are absolute; the resolver resolves a relative repository path against
	// the home path before matching, so the prefix has to be resolved the same way.
	path := cfg.ProvisioningBootstrapPath
	if !filepath.IsAbs(path) {
		path = filepath.Join(cfg.HomePath, path)
	}
	return append(slices.Clone(cfg.PermittedProvisioningPaths), path)
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
