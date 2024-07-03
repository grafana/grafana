package sqlobj

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Package-level errors.
var (
	ErrNotImplementedYet = errors.New("not implemented yet (sqlobj)")
)

func ProvideSQLResourceServer(db db.DB, tracer tracing.Tracer) (resource.ResourceServer, error) {
	store := &sqlResourceStore{
		db:     db,
		log:    slog.Default().With("logger", "unistore-sql-objects"),
		tracer: tracer,
	}

	return resource.NewResourceServer(resource.ResourceServerOptions{
		Tracer:      tracer,
		Backend:     store,
		Diagnostics: store,
		Lifecycle:   store,
	})
}

type sqlResourceStore struct {
	log    *slog.Logger
	db     db.DB
	tracer trace.Tracer

	broadcaster resource.Broadcaster[*resource.WrittenEvent]

	// Simple watch stream -- NOTE, this only works for single tenant!
	stream chan<- *resource.WrittenEvent
}

func (s *sqlResourceStore) Init() (err error) {
	s.broadcaster, err = resource.NewBroadcaster(context.Background(), func(c chan<- *resource.WrittenEvent) error {
		s.stream = c
		return nil
	})
	return
}

func (s *sqlResourceStore) IsHealthy(ctx context.Context, r *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	return &resource.HealthCheckResponse{Status: resource.HealthCheckResponse_SERVING}, nil
}

func (s *sqlResourceStore) Stop() {
	if s.stream != nil {
		close(s.stream)
	}
}

func (s *sqlResourceStore) WriteEvent(ctx context.Context, event resource.WriteEvent) (rv int64, err error) {
	_, span := s.tracer.Start(ctx, "sql_resource.WriteEvent")
	defer span.End()

	key := event.Key

	// This delegates resource version creation to auto-increment
	// At scale, this is not a great strategy since everything is locked across all resources while this executes
	appender := func(tx *session.SessionTx) (int64, error) {
		return tx.ExecWithReturningId(ctx,
			`INSERT INTO "object" ("group","namespace","resource","name","value") VALUES($1,$2,$3,$4,$5)`,
			key.Group, key.Namespace, key.Resource, key.Name, event.Value)
	}

	wiper := func(tx *session.SessionTx) (sql.Result, error) {
		return tx.Exec(ctx, `DELETE FROM "object" WHERE `+
			`"group"=$1 AND `+
			`"namespace"=$2 AND `+
			`"resource"=$3 AND `+
			`"name"=$4`,
			key.Group, key.Namespace, key.Resource, key.Name)
	}

	err = s.db.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		switch event.Type {
		case resource.WatchEvent_ADDED:
			rv, err = appender(tx)

		case resource.WatchEvent_MODIFIED:
			_, err = wiper(tx)
			if err == nil {
				rv, err = appender(tx)
			}
		case resource.WatchEvent_DELETED:
			_, err = wiper(tx)
		default:
			return fmt.Errorf("unsupported event type")
		}
		return err
	})

	// Async notify all subscribers
	if s.stream != nil {
		go func() {
			write := &resource.WrittenEvent{
				WriteEvent:      event,
				Timestamp:       time.Now().UnixMilli(),
				ResourceVersion: rv,
			}
			s.stream <- write
		}()
	}
	return
}

func (s *sqlResourceStore) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	return s.broadcaster.Subscribe(ctx)
}

func (s *sqlResourceStore) Read(ctx context.Context, req *resource.ReadRequest) (*resource.ReadResponse, error) {
	_, span := s.tracer.Start(ctx, "storage_server.GetResource")
	defer span.End()

	key := req.Key
	rows, err := s.db.GetSqlxSession().Query(ctx, "SELECT rv,value FROM object WHERE group=$1 AND namespace=$2 AND resource=$3 AND name=$4",
		key.Group, key.Namespace, key.Resource, key.Name)
	if err != nil {
		return nil, err
	}
	if rows.Next() {
		rsp := &resource.ReadResponse{}
		err = rows.Scan(&rsp.ResourceVersion, &rsp.Value)
		if err == nil && rows.Next() {
			return nil, fmt.Errorf("unexpected multiple results found") // should not be possible with the index strategy
		}
		return rsp, err
	}
	return nil, fmt.Errorf("NOT FOUND ERROR")
}

// This implementation is only ever called from inside single tenant grafana, so there is no need to decode
// the value and try filtering first -- that will happen one layer up anyway
func (s *sqlResourceStore) PrepareList(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	_, span := s.tracer.Start(ctx, "storage_server.List")
	defer span.End()

	if req.NextPageToken != "" {
		return nil, fmt.Errorf("This storage backend does not support paging")
	}

	max := 250
	key := req.Options.Key
	rsp := &resource.ListResponse{}
	rows, err := s.db.GetSqlxSession().Query(ctx,
		"SELECT rv,value FROM object \n"+
			` WHERE "group"=$1 AND namespace=$2 AND resource=$3 `+
			" ORDER BY name asc LIMIT $4",
		key.Group, key.Namespace, key.Resource, max+1)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		wrapper := &resource.ResourceWrapper{}
		err = rows.Scan(&wrapper.ResourceVersion, &wrapper.Value)
		if err != nil {
			break
		}
		rsp.Items = append(rsp.Items, wrapper)
	}
	if len(rsp.Items) > max {
		err = fmt.Errorf("more values that are supported by this storage engine")
	}
	return rsp, err
}
