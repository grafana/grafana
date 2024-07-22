package basic

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const trace_prefix = "basic.sql.resource."
const table_name = "basic_resource"

type ResourceServerOptions struct {
	DB            db.DB
	GroupResource schema.GroupResource
	Tracer        trace.Tracer
	MaxItems      int
}

// This storage engine is not designed to support large collections
// The goal with this package is a production ready implementation that
// can support modest requirements.  By design, this will scan all
// results on all list operations, so we do not want this to grow too big
func NewResourceServer(opts ResourceServerOptions) (resource.ResourceServer, error) {
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("resource-server")
	}

	store := &basicSQLBackend{
		db:     opts.DB,
		gr:     opts.GroupResource,
		tracer: opts.Tracer,
		log:    slog.Default().With("logger", "basic-sql-resource"),
	}

	return resource.NewResourceServer(resource.ResourceServerOptions{
		Tracer:      opts.Tracer,
		Backend:     store,
		Diagnostics: store,
		Lifecycle:   store,
	})
}

type basicSQLBackend struct {
	log      *slog.Logger
	db       db.DB
	gr       schema.GroupResource
	maxItems int
	tracer   trace.Tracer

	// Simple watch stream -- NOTE, this only works for single tenant!
	broadcaster resource.Broadcaster[*resource.WrittenEvent]

	stream chan<- *resource.WrittenEvent
}

func (s *basicSQLBackend) Init() (err error) {
	s.broadcaster, err = resource.NewBroadcaster(context.Background(), func(c chan<- *resource.WrittenEvent) error {
		s.stream = c
		return nil
	})
	return
}

func (s *basicSQLBackend) IsHealthy(ctx context.Context, r *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	return &resource.HealthCheckResponse{Status: resource.HealthCheckResponse_SERVING}, nil
}

func (s *basicSQLBackend) Stop() {
	if s.stream != nil {
		close(s.stream)
	}
}

func (s *basicSQLBackend) validateKey(key *resource.ResourceKey) error {
	if s.gr.Group != "" && s.gr.Group != key.Group {
		return fmt.Errorf("expected group: %s, found: %s", s.gr.Group, key.Group)
	}
	if s.gr.Resource != "" && s.gr.Resource != key.Resource {
		return fmt.Errorf("expected resource: %s, found: %s", s.gr.Resource, key.Resource)
	}
	return nil
}

func (s *basicSQLBackend) WriteEvent(ctx context.Context, event resource.WriteEvent) (rv int64, err error) {
	_, span := s.tracer.Start(ctx, trace_prefix+"WriteEvent")
	defer span.End()

	key := event.Key
	err = s.validateKey(key)
	if err != nil {
		return
	}
	gvk := event.Object.GetGroupVersionKind()

	// This delegates resource version creation to auto-increment
	// At scale, this is not a great strategy since everything is locked across all resources while this executes
	appender := func(tx *session.SessionTx) (int64, error) {
		return tx.ExecWithReturningId(ctx,
			`INSERT INTO `+table_name+` (api_group,api_version,namespace,resource,name,value) VALUES($1,$2,$3,$4,$5,$6)`,
			key.Group, gvk.Version, key.Namespace, key.Resource, key.Name, event.Value)
	}

	wiper := func(tx *session.SessionTx) (sql.Result, error) {
		return tx.Exec(ctx, `DELETE FROM `+table_name+` WHERE `+
			`api_group=$1 AND `+
			`namespace=$2 AND `+
			`resource=$3 AND `+
			`name=$4`,
			key.Group, key.Namespace, key.Resource, key.Name)
	}

	err = s.db.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		switch event.Type {
		case resource.WatchEvent_ADDED:
			count := 0
			err = tx.Get(ctx, &count, `SELECT count(*) FROM `+table_name+` WHERE api_group=$1 AND resource=$2`, key.Group, key.Resource)
			if err != nil {
				return err
			}
			if count >= s.maxItems {
				return fmt.Errorf("the storage backend only supports %d items", s.maxItems)
			}
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

func (s *basicSQLBackend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	return s.broadcaster.Subscribe(ctx)
}

func (s *basicSQLBackend) Read(ctx context.Context, req *resource.ReadRequest) (*resource.ReadResponse, error) {
	_, span := s.tracer.Start(ctx, trace_prefix+"Read")
	defer span.End()

	key := req.Key
	err := s.validateKey(key)
	if err != nil {
		return nil, err
	}

	rows, err := s.db.GetSqlxSession().Query(ctx, "SELECT rv,value FROM "+table_name+" WHERE api_group=$1 AND namespace=$2 AND resource=$3 AND name=$4",
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
func (s *basicSQLBackend) PrepareList(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	if req.NextPageToken != "" {
		return nil, fmt.Errorf("this storage backend does not support paging")
	}
	_, span := s.tracer.Start(ctx, trace_prefix+"PrepareList")
	defer span.End()

	key := req.Options.Key
	err := s.validateKey(key)
	if err != nil {
		return nil, err
	}
	rsp := &resource.ListResponse{}
	rows, err := s.db.GetSqlxSession().Query(ctx,
		"SELECT rv,value FROM "+table_name+
			" WHERE api_group=$1 AND namespace=$2 AND resource=$3 "+
			" ORDER BY name asc LIMIT $4",
		key.Group, key.Namespace, key.Resource, s.maxItems+1)
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
	if len(rsp.Items) > s.maxItems {
		err = fmt.Errorf("more values that are supported by this storage engine")
	}
	return rsp, err
}
