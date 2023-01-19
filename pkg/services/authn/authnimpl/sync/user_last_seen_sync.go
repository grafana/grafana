package sync

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/user"
)

func ProvideUserLastSeenSync(service user.Service) *UserLastSeenSync {
	return &UserLastSeenSync{log.New("userlastseen.sync"), service}
}

type UserLastSeenSync struct {
	log     log.Logger
	service user.Service
}

func (s *UserLastSeenSync) SyncLastSeen(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	namespace, id := identity.NamespacedID()

	if namespace != authn.NamespaceUser && namespace != authn.NamespaceServiceAccount {
		// skip sync
		return nil
	}

	if !shouldUpdateLastSeen(identity.LastSeenAt) {
		return nil
	}

	go func(userID int64) {
		defer func() {
			if err := recover(); err != nil {
				s.log.Error("panic during user last seen sync", "err", err)
			}
		}()

		if err := s.service.UpdateLastSeenAt(context.Background(), &user.UpdateUserLastSeenAtCommand{UserID: userID}); err != nil {
			s.log.Error("failed to update last_seen_at", "err", err, "userId", userID)
		}
	}(id)

	return nil
}

func shouldUpdateLastSeen(t time.Time) bool {
	return time.Since(t) > time.Minute*5
}
