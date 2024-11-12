package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideNamespaceSync(cfg *setting.Cfg) *NamespaceSync {
	return &NamespaceSync{
		mapper: request.GetNamespaceMapper(cfg),
	}
}

type NamespaceSync struct {
	mapper request.NamespaceMapper
}

func (s *NamespaceSync) SyncNamespace(ctx context.Context, id *authn.Identity, _ *authn.Request) error {
	if id.Namespace != "" {
		return nil
	}

	id.Namespace = s.mapper(id.OrgID)
	return nil
}
