package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/authn"
)

func ProvideAPIKeyLastSeenSync(service apikey.Service) *APIKeyLastSeenSync {
	return &APIKeyLastSeenSync{log.New("apikeylastseen.sync"), service}
}

type APIKeyLastSeenSync struct {
	log     log.Logger
	service apikey.Service
}

func (s *APIKeyLastSeenSync) SyncLastSeen(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	namespace, id := identity.NamespacedID()
	if namespace != authn.NamespaceAPIKey {
		return nil
	}

	go func(apikeyID int64) {
		defer func() {
			if err := recover(); err != nil {
				s.log.Error("panic during user last seen sync", "err", err)
			}
		}()
		if err := s.service.UpdateAPIKeyLastUsedDate(context.Background(), apikeyID); err != nil {
			s.log.Warn("failed to update last use date for api key", "id", apikeyID)
		}
	}(id)

	return nil
}
