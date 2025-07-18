package extras

import (
	"github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks"
)

// HACK: This is a hack so that wire can uniquely identify dependencies
func ProvideProvisioningOSSExtras(webhook webhooks.WebhookExtraBuilder) []provisioning.ExtraBuilder {
	return []provisioning.ExtraBuilder{
		webhook.ExtraBuilder,
	}
}
