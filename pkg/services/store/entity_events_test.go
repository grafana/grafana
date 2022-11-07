package store

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
)

func saveEvent(ctx context.Context, sql db.DB, cmd SaveEventCmd) error {
	entityEvent := &EntityEvent{
		EventType: cmd.EventType,
		EntityId:  cmd.EntityId,
		Created:   time.Now().Unix(),
	}
	return sql.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(entityEvent)
		return err
	})
}

func TestIntegrationEntityEventsService(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ctx := context.Background()

	setup := func() *entityEventService {
		return &entityEventService{
			sql: db.InitTestDB(t),
			log: log.New("entity-event-test"),
		}
	}

	t.Run("Should insert an entity event", func(t *testing.T) {
		service := setup()
		err := saveEvent(ctx, service.sql, SaveEventCmd{
			EntityId:  "database/dash/1",
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)
	})

	t.Run("Should retrieve nil entity if database is empty", func(t *testing.T) {
		service := setup()
		ev, err := service.GetLastEvent(ctx)
		require.NoError(t, err)
		require.Nil(t, ev)
	})

	t.Run("Should retrieve last entity event", func(t *testing.T) {
		service := setup()
		lastEventEntityId := "database/dash/1"

		err := saveEvent(ctx, service.sql, SaveEventCmd{
			EntityId:  "database/dash/3",
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)
		err = saveEvent(ctx, service.sql, SaveEventCmd{
			EntityId:  "database/dash/2",
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)
		err = saveEvent(ctx, service.sql, SaveEventCmd{
			EntityId:  lastEventEntityId,
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)

		lastEv, err := service.GetLastEvent(ctx)
		require.NoError(t, err)
		require.Equal(t, lastEventEntityId, lastEv.EntityId)
	})

	t.Run("Should retrieve sorted events after an id", func(t *testing.T) {
		service := setup()
		lastEventEntityId := "database/dash/1"

		err := saveEvent(ctx, service.sql, SaveEventCmd{
			EntityId:  "database/dash/3",
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)
		firstEv, err := service.GetLastEvent(ctx)
		require.NoError(t, err)
		firstEvId := firstEv.Id

		err = saveEvent(ctx, service.sql, SaveEventCmd{
			EntityId:  "database/dash/2",
			EventType: EntityEventTypeCreate,
		})
		require.NoError(t, err)
		err = saveEvent(ctx, service.sql, SaveEventCmd{
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
		service := setup()
		_ = saveEvent(ctx, service.sql, SaveEventCmd{
			EntityId:  "database/dash/3",
			EventType: EntityEventTypeCreate,
		})
		_ = saveEvent(ctx, service.sql, SaveEventCmd{
			EntityId:  "database/dash/2",
			EventType: EntityEventTypeCreate,
		})
		_ = saveEvent(ctx, service.sql, SaveEventCmd{
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
	if testing.Short() {
		t.Skip("skipping integration test")
	}
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
