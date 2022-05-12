//go:build integration
// +build integration

package store

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestIntegrationEntityEventsService(t *testing.T) {
	var ctx context.Context
	var service EntityEventsService

	setup := func() {
		service = &entityEventService{
			sql: sqlstore.InitTestDB(t),
			log: log.New("entity-event-test"),
		}
		ctx = context.Background()
	}

	t.Run("Should insert an entity event", func(t *testing.T) {
		setup()

		err := service.SaveEvent(ctx, SaveEventCmd{
			EntityId:  "database/dash/1",
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)
	})

	t.Run("Should retrieve nil entity if database is empty", func(t *testing.T) {
		setup()

		ev, err := service.GetLastEvent(ctx)
		require.NoError(t, err)
		require.Nil(t, ev)
	})

	t.Run("Should retrieve last entity event", func(t *testing.T) {
		setup()
		lastEventEntityId := "database/dash/1"

		err := service.SaveEvent(ctx, SaveEventCmd{
			EntityId:  "database/dash/3",
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)
		err = service.SaveEvent(ctx, SaveEventCmd{
			EntityId:  "database/dash/2",
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)
		err = service.SaveEvent(ctx, SaveEventCmd{
			EntityId:  lastEventEntityId,
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)

		lastEv, err := service.GetLastEvent(ctx)
		require.NoError(t, err)
		require.Equal(t, lastEventEntityId, lastEv.EntityId)
	})

	t.Run("Should retrieve sorted events after an id", func(t *testing.T) {
		setup()
		lastEventEntityId := "database/dash/1"

		err := service.SaveEvent(ctx, SaveEventCmd{
			EntityId:  "database/dash/3",
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)
		firstEv, err := service.GetLastEvent(ctx)
		firstEvId := firstEv.Id

		err = service.SaveEvent(ctx, SaveEventCmd{
			EntityId:  "database/dash/2",
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)
		err = service.SaveEvent(ctx, SaveEventCmd{
			EntityId:  lastEventEntityId,
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)

		evs, err := service.GetAllEventsAfter(ctx, firstEvId)
		require.NoError(t, err)
		require.Len(t, evs, 2)
		require.Equal(t, evs[0].EntityId, "database/dash/2")
		require.Equal(t, evs[1].EntityId, lastEventEntityId)
	})

	t.Run("Should delete old events", func(t *testing.T) {
		setup()
		_ = service.SaveEvent(ctx, SaveEventCmd{
			EntityId:  "database/dash/3",
			EventType: EntityEventTypeCreate,
		})
		_ = service.SaveEvent(ctx, SaveEventCmd{
			EntityId:  "database/dash/2",
			EventType: EntityEventTypeCreate,
		})
		_ = service.SaveEvent(ctx, SaveEventCmd{
			EntityId:  "database/dash/1",
			EventType: EntityEventTypeCreate,
		})

		evs, err := service.GetAllEventsAfter(ctx, 0)
		require.NoError(t, err)
		require.Len(t, evs, 3)

		err = service.deleteEventsOlderThan(ctx, 24*time.Hour)
		require.NoError(t, err)

		// did not delete any events
		evs, err = service.GetAllEventsAfter(ctx, 0)
		require.NoError(t, err)
		require.Len(t, evs, 3)

		time.Sleep(2 * time.Second)
		err = service.deleteEventsOlderThan(ctx, 1*time.Second)
		require.NoError(t, err)

		// deleted all events
		evs, err = service.GetAllEventsAfter(ctx, 0)
		require.NoError(t, err)
		require.Len(t, evs, 0)
	})
}

func TestIntegrationCreateDatabaseEntityId(t *testing.T) {
	tests := []struct {
		name       string
		entityType EntityType
		orgId      int64
		internalId interface{}
		expected   string
	}{
		{
			name:       "int64 internal id",
			entityType: EntityTypeDashboard,
			orgId:      10,
			internalId: int64(45),
			expected:   "database/10/dashboard/45",
		},
		{
			name:       "big-ish int64 internal id",
			entityType: EntityTypeDashboard,
			orgId:      10,
			internalId: int64(12412421),
			expected:   "database/10/dashboard/12412421",
		},
		{
			name:       "int internal id",
			entityType: EntityTypeDashboard,
			orgId:      10,
			internalId: int(1244),
			expected:   "database/10/dashboard/1244",
		},
		{
			name:       "string internal id",
			entityType: EntityTypeDashboard,
			orgId:      10,
			internalId: "string-internal-id",
			expected:   "database/10/dashboard/string-internal-id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, CreateDatabaseEntityId(tt.internalId, tt.orgId, tt.entityType))
		})
	}
}
