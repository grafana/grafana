package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhook"
)

type Getter interface {
	GetRepository(ctx context.Context, name string) (repository.Repository, error)
	GetWebhook(ctx context.Context, name string) (webhook.Webhook, error)
}
