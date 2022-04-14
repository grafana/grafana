package store

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type EntityEventType string

const (
	EntityEventTypeDelete EntityEventType = "delete"
	EntityEventTypeCreate EntityEventType = "create"
	EntityEventTypeUpdate EntityEventType = "update"
)

type EntityEvent struct {
	Id        int64
	EventType EntityEventType
	Grn       string
	Created   time.Time
}

type SaveEventCmd struct {
	Grn       string
	EventType EntityEventType
}

// EntityEventsService is a temporary solution to support change notifications in an HA setup
// With this service each system can query for any events that have happened since a fixed time
//go:generate mockery --name EntityEventsService --structname MockEntityEventsService --inpackage --filename entity_events_mock.go
type EntityEventsService interface {
	SaveEvent(ctx context.Context, cmd SaveEventCmd) error
	GetLastEvent(ctx context.Context) (*EntityEvent, error)
	GetAllEventsAfter(ctx context.Context, id int64) ([]*EntityEvent, error)

	Run(ctx context.Context) error

	deleteEventsOlderThan(ctx context.Context, duration time.Duration) error
}

func ProvideEntityEventsService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore) EntityEventsService {
	return &entityEventService{
		sql: sqlStore,
		log: log.New("entity-events"),
	}
}

type entityEventService struct {
	sql *sqlstore.SQLStore
	log log.Logger
}

func (e *entityEventService) SaveEvent(ctx context.Context, cmd SaveEventCmd) error {
	return e.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Insert(&EntityEvent{
			EventType: cmd.EventType,
			Grn:       cmd.Grn,
			Created:   time.Now(),
		})
		return err
	})
}

func (e *entityEventService) GetLastEvent(ctx context.Context) (*EntityEvent, error) {
	var entityEvent *EntityEvent
	err := e.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		bean := &EntityEvent{}
		found, err := sess.OrderBy("id desc").Get(bean)
		if found {
			entityEvent = bean
		}
		return err
	})

	return entityEvent, err
}

func (e *entityEventService) GetAllEventsAfter(ctx context.Context, id int64) ([]*EntityEvent, error) {
	var evs = make([]*EntityEvent, 0)
	err := e.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return sess.OrderBy("id asc").Where("id > ?", id).Find(&evs)
	})

	return evs, err
}

func (e *entityEventService) deleteEventsOlderThan(ctx context.Context, duration time.Duration) error {
	return e.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		maxCreated := time.Now().Add(-duration)
		deletedCount, err := sess.Where("created < ?", maxCreated.Unix()).Delete(&EntityEvent{})
		e.log.Info("deleting old events", "count", deletedCount, "maxCreated", maxCreated)
		return err
	})
}

func (e *entityEventService) Run(ctx context.Context) error {
	clean := time.NewTicker(1 * time.Hour)

	for {
		select {
		case <-clean.C:
			go func() {
				err := e.deleteEventsOlderThan(context.Background(), 24*time.Hour)
				if err != nil {
					e.log.Info("failed to delete old entity events", "error", err)
				}
			}()
		case <-ctx.Done():
			e.log.Debug("Grafana is shutting down - stopping entity events service")
			clean.Stop()
			return nil
		}
	}
}
