package migration

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

// OrgMigration is a helper struct for migrating alerts for a single org. It contains state, services, and caches.
type OrgMigration struct {
	cfg *setting.Cfg
	log log.Logger

	migrationStore    migrationStore.Store
	encryptionService secrets.Service

	orgID int64

	silences *silenceHandler
}

// newOrgMigration creates a new OrgMigration for the given orgID.
func (ms *migrationService) newOrgMigration(orgID int64) *OrgMigration {
	return &OrgMigration{
		cfg: ms.cfg,
		log: ms.log.New("orgID", orgID),

		migrationStore:    ms.migrationStore,
		encryptionService: ms.encryptionService,
		silences:          ms.silences,

		orgID: orgID,
	}
}

// ChannelCache caches channels by ID and UID.
type ChannelCache struct {
	channels []*legacymodels.AlertNotification
	cache    map[any]*legacymodels.AlertNotification
	fetch    func(ctx context.Context, key notificationKey) (*legacymodels.AlertNotification, error)
}

func (c *ChannelCache) Get(ctx context.Context, key notificationKey) (*legacymodels.AlertNotification, error) {
	if key.ID > 0 {
		if channel, ok := c.cache[key.ID]; ok {
			return channel, nil
		}
	}
	if key.UID != "" {
		if channel, ok := c.cache[key.UID]; ok {
			return channel, nil
		}
	}

	channel, err := c.fetch(ctx, key)
	if err != nil {
		if errors.Is(err, migrationStore.ErrNotFound) {
			if key.ID > 0 {
				c.cache[key.ID] = nil
			}
			if key.UID != "" {
				c.cache[key.UID] = nil
			}
			return nil, nil
		}
		return nil, err
	}

	c.cache[channel.ID] = channel
	c.cache[channel.UID] = channel
	c.channels = append(c.channels, channel)

	return channel, nil
}

func (ms *migrationService) newChannelCache(orgID int64) *ChannelCache {
	return &ChannelCache{
		cache: make(map[any]*legacymodels.AlertNotification),
		fetch: func(ctx context.Context, key notificationKey) (*legacymodels.AlertNotification, error) {
			c, err := ms.migrationStore.GetNotificationChannel(ctx, migrationStore.GetNotificationChannelQuery{OrgID: orgID, ID: key.ID, UID: key.UID})
			if err != nil {
				return nil, err
			}
			return c, nil
		},
	}
}
