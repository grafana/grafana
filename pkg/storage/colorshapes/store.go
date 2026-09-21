// Package colorshapes implements the SQL storage backing the apps/colorshapes
// learning app. It lives in the main module (not in apps/colorshapes/go.mod) because it
// needs pkg/infra/db, which app modules intentionally don't depend on directly — see
// apps/colorshapes/plan.md.
package colorshapes

import (
	"context"
	"time"

	colorshapesapp "github.com/grafana/grafana/apps/colorshapes/pkg/app"
	"github.com/grafana/grafana/pkg/infra/db"
)

var _ colorshapesapp.Store = (*Store)(nil)

type Store struct {
	db db.DB
}

func ProvideStore(db db.DB) *Store {
	return &Store{db: db}
}

// hitRow is the xorm-mapped row for the colorshape_hit table (see
// pkg/services/sqlstore/migrations/colorshapes_mig.go).
type hitRow struct {
	ID        int64  `xorm:"pk autoincr 'id'"`
	CreatedAt int64  `xorm:"created_at"`
	SourceIP  string `xorm:"source_ip"`
	Color     string `xorm:"color"`
	Shape     string `xorm:"shape"`
	CreatedBy string `xorm:"created_by"`
}

type eventRow struct {
	ID         int64  `xorm:"pk autoincr 'id'"`
	EventID    string `xorm:"event_id"`
	ProjectID  string `xorm:"project_id"`
	Message    string `xorm:"message"`
	OccurredAt int64  `xorm:"occurred_at"`
	RawEvent   string `xorm:"raw_event"`
}

func (eventRow) TableName() string { return "error_tracking_event" }

func (hitRow) TableName() string {
	return "colorshape_hit"
}

func (s *Store) Insert(ctx context.Context, createdBy, sourceIP, color, shape string) error {
	row := &hitRow{
		CreatedAt: time.Now().UnixMilli(),
		SourceIP:  sourceIP,
		Color:     color,
		Shape:     shape,
		CreatedBy: createdBy,
	}
	return s.db.WithDbSession(ctx, func(session *db.Session) error {
		_, err := session.Insert(row)
		return err
	})
}

func (s *Store) List(ctx context.Context, from, to time.Time) ([]colorshapesapp.Hit, error) {
	var rows []*hitRow
	err := s.db.WithDbSession(ctx, func(session *db.Session) error {
		return session.
			Where("created_at >= ? AND created_at <= ?", from.UnixMilli(), to.UnixMilli()).
			OrderBy("created_at DESC").
			Find(&rows)
	})
	if err != nil {
		return nil, err
	}

	hits := make([]colorshapesapp.Hit, 0, len(rows))
	for _, r := range rows {
		hits = append(hits, colorshapesapp.Hit{
			CreatedAt: r.CreatedAt,
			SourceIP:  r.SourceIP,
			Color:     r.Color,
			Shape:     r.Shape,
			CreatedBy: r.CreatedBy,
		})
	}
	return hits, nil
}

func (s *Store) InsertEvent(ctx context.Context, eventID, projectID, message, rawEvent string, occurredAt int64) (bool, error) {
	row := &eventRow{EventID: eventID, ProjectID: projectID, Message: message, OccurredAt: occurredAt, RawEvent: rawEvent}
	var inserted bool
	err := s.db.WithDbSession(ctx, func(session *db.Session) error {
		_, err := session.Insert(row)
		if err != nil && s.db.GetDialect().IsUniqueConstraintViolation(err) {
			return nil
		}
		if err == nil {
			inserted = true
		}
		return err
	})
	return inserted, err
}

func (s *Store) ListEvents(ctx context.Context, from, to time.Time) ([]colorshapesapp.Event, error) {
	var rows []*eventRow
	err := s.db.WithDbSession(ctx, func(session *db.Session) error {
		return session.Where("occurred_at >= ? AND occurred_at <= ?", from.UnixMilli(), to.UnixMilli()).OrderBy("occurred_at DESC").Find(&rows)
	})
	if err != nil {
		return nil, err
	}
	events := make([]colorshapesapp.Event, 0, len(rows))
	for _, row := range rows {
		events = append(events, colorshapesapp.Event{EventID: row.EventID, ProjectID: row.ProjectID, Message: row.Message, OccurredAt: row.OccurredAt})
	}
	return events, nil
}
