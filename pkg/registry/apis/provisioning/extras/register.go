package extras

import (
	"github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/local"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/setting"
)

// HACK: This is a hack so that wire can uniquely identify dependencies
func ProvideProvisioningOSSExtras(webhook webhooks.WebhookExtraBuilder) []provisioning.ExtraBuilder {
	return []provisioning.ExtraBuilder{
		webhook.ExtraBuilder,
	}
}

func ProvideProvisioningOSSRepositoryExtras(
	cfg *setting.Cfg,
	decryptSvc secret.DecryptService,
	ghFactory *github.Factory,
	// TODO: We need the webhook
) []repository.Extra {
	return []repository.Extra{
		local.Extra(cfg),
		github.Extra(repository.DecryptService(decryptSvc), ghFactory),
	}
}
