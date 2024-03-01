package sqlstash

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/google/uuid"
	"github.com/lib/pq"

	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
)

// Make sure we implement both store + admin
var _ entity.EntityStoreServer = &sqlEntityServer{}

// Package level errors.
var (
	ErrUnauthorizedNamespace = errors.New("namespace not authorized for user")
	ErrNotPostgresDriver     = errors.New("expecting postgres driver")
	ErrPgListenerNotInit     = errors.New("postgres listener not initialized")
	ErrPgWatchTerminated     = errors.New("watch operation terminated by the administrator")
)

const (
	DefaultPgWatcherChannelBufferLen      = 64
	DefaultPgListenerMinReconnectInterval = 10 * time.Second
	DefaultPgListenerMaxReconnectInterval = time.Minute
)

func ProvideSQLEntityServer(db db.EntityDBInterface /*, cfg *setting.Cfg */) (entity.EntityStoreServer, error) {
	entityServer := &sqlEntityServer{
		db:                             db,
		log:                            log.New("sql-entity-server"),
		pgWatcherChannelBufferLen:      DefaultPgWatcherChannelBufferLen,
		pgListenerMinReconnectInterval: DefaultPgListenerMinReconnectInterval,
		pgListenerMaxReconnectInterval: DefaultPgListenerMaxReconnectInterval,
	}

	return entityServer, nil
}

type sqlEntityServer struct {
	log         log.Logger
	db          db.EntityDBInterface // needed to keep xorm engine in scope
	sess        *session.SessionDB
	dialect     migrator.Dialect
	snowflake   *snowflake.Node
	broadcaster Broadcaster[*entity.Entity]

	// Postgres LISTEN/NOTIFY. TODO: move to a different struct
	pgListener   *pq.Listener
	pgBrokerDone chan struct{}
	pgListenerMu sync.RWMutex

	pgNotifyMap   pgChannelMap
	pgNotifyMapMu sync.RWMutex

	// TODO: make configurable
	pgWatcherChannelBufferLen      int
	pgListenerMinReconnectInterval time.Duration
	pgListenerMaxReconnectInterval time.Duration
}

// Types aliases that serve to provide consistent namning and documentation throughout postgres LISTEN/NOTIFY
// implementation for the Watch method of entity.EntityStoreServer.
type (
	// pgWatcherChannel is a channel of postgres notifications. These channels are created by watchers and registered by
	// pgAddNotifyChan. Watchers only receive from them, then the broker sends to them, and finally pgRemoveNotifyChan
	// closes them. (*pq.Listener).NotificationChannel() returns a receive-only version of this channel, whose values
	// are forwarded to the appropriate watchers through pgWatcherChannel.
	pgWatcherChannel = chan<- *pq.Notification

	// pgWatcherChannelMap could be better expressed as a map[pgWatcherChannel]struct{}, except for the fact that
	// pgWatcherChannel is a channel type, hence it's not comparable and cannot be used as a map key. We could use
	// anything, like a random UUID, as the key, but we chose to use a pointer type because it's far more trivial and
	// provides an even stronger against collisions, since a new allocation will provide a unique address, and all we
	// care for here is uniqueness at the server process level. Note that we cannot use something like *struct{} since
	// the Go compiler optimizes all *struct{} to point to the same address, so we need to choose something else.
	pgWatcherChannelMapKey = *byte
	pgWatcherChannelMap    = map[pgWatcherChannelMapKey]pgWatcherChannel

	// pgChannel is a postgres channel identifier, which is used to call the postgres LISTEN SQL command on it to
	// receive notifications of changes to "entity" table. These notifications are created by a trigger on that table
	// that calls the postgres NOTIFY SQL command, and include a payload JSON payload that we decode on this side.
	pgChannel = string

	// pgChannelMap holds a reference to all watcher channels. As we could receive multiple Watch requests for the same
	// channel (which we map to a k8s namespace, which in turn we map to a Grafana tenant), then we use each of these
	// pgWatcherChannel to provide the appropriate notifications to each client served.
	pgChannelMap = map[pgChannel]pgWatcherChannelMap
)

func (s *sqlEntityServer) Init() error {
	if s.sess != nil {
		return nil
	}

	if s.db == nil {
		return errors.New("missing db")
	}

	err := s.db.Init()
	if err != nil {
		return err
	}

	sess, err := s.db.GetSession()
	if err != nil {
		return err
	}

	engine, err := s.db.GetEngine()
	if err != nil {
		return err
	}

	s.sess = sess
	s.dialect = migrator.NewDialect(engine.DriverName())

	// initialize snowflake generator
	s.snowflake, err = snowflake.NewNode(rand.Int63n(1024))
	if err != nil {
		return err
	}

	// set up the broadcaster
	s.broadcaster, err = NewBroadcaster(context.Background(), func(stream chan *entity.Entity) error {
		// start the poller
		go s.poller(stream)

		return nil
	})
	if err != nil {
		return err
	}

	return nil
}

func (s *sqlEntityServer) getReadFields(r *entity.ReadEntityRequest) []string {
	fields := []string{
		"guid",
		"key",
		"namespace", "group", "group_version", "resource", "name", "folder",
		"resource_version", "size", "etag", "errors", // errors are always returned
		"created_at", "created_by",
		"updated_at", "updated_by",
		"origin", "origin_key", "origin_ts",
		"meta",
		"title", "slug", "description", "labels", "fields",
		"message",
		"action",
	}

	if r.WithBody {
		fields = append(fields, `body`)
	}
	if r.WithStatus {
		fields = append(fields, "status")
	}

	return fields
}

func (s *sqlEntityServer) getReadSelect(r *entity.ReadEntityRequest) (string, error) {
	if err := s.Init(); err != nil {
		return "", err
	}

	fields := s.getReadFields(r)

	quotedFields := make([]string, len(fields))
	for i, f := range fields {
		quotedFields[i] = s.dialect.Quote(f)
	}
	return "SELECT " + strings.Join(quotedFields, ","), nil
}

func (s *sqlEntityServer) rowToEntity(ctx context.Context, rows *sql.Rows, withBody, withStatus bool) (*entity.Entity, error) {
	raw := &entity.Entity{
		Origin: &entity.EntityOriginInfo{},
	}

	var errors, labels, fields string

	args := []any{
		&raw.Guid,
		&raw.Key,
		&raw.Namespace, &raw.Group, &raw.GroupVersion, &raw.Resource, &raw.Name, &raw.Folder,
		&raw.ResourceVersion, &raw.Size, &raw.ETag, &errors,
		&raw.CreatedAt, &raw.CreatedBy,
		&raw.UpdatedAt, &raw.UpdatedBy,
		&raw.Origin.Source, &raw.Origin.Key, &raw.Origin.Time,
		&raw.Meta,
		&raw.Title, &raw.Slug, &raw.Description, &labels, &fields,
		&raw.Message,
		&raw.Action,
	}
	if withBody {
		args = append(args, &raw.Body)
	}
	if withStatus {
		args = append(args, &raw.Status)
	}

	err := rows.Scan(args...)
	if err != nil {
		return nil, err
	}

	// unmarshal json labels
	if labels != "" {
		if err := json.NewDecoder(strings.NewReader(labels)).Decode(&raw.Labels); err != nil {
			return nil, err
		}
	}

	// set empty body, meta or status to nil
	if raw.Body != nil && len(raw.Body) == 0 {
		raw.Body = nil
	}
	if raw.Meta != nil && len(raw.Meta) == 0 {
		raw.Meta = nil
	}
	if raw.Status != nil && len(raw.Status) == 0 {
		raw.Status = nil
	}

	return raw, nil
}

func (s *sqlEntityServer) Read(ctx context.Context, r *entity.ReadEntityRequest) (*entity.Entity, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	return s.read(ctx, s.sess, r)
}

func (s *sqlEntityServer) read(ctx context.Context, tx session.SessionQuerier, r *entity.ReadEntityRequest) (*entity.Entity, error) {
	table := "entity"
	where := []string{}
	args := []any{}

	if r.Key == "" {
		return nil, fmt.Errorf("missing key")
	}

	key, err := entity.ParseKey(r.Key)
	if err != nil {
		return nil, err
	}

	where = append(where, s.dialect.Quote("namespace")+"=?", s.dialect.Quote("group")+"=?", s.dialect.Quote("resource")+"=?", s.dialect.Quote("name")+"=?")
	args = append(args, key.Namespace, key.Group, key.Resource, key.Name)

	if r.ResourceVersion != 0 {
		table = "entity_history"
		where = append(where, s.dialect.Quote("resource_version")+"=?")
		args = append(args, r.ResourceVersion)
	}

	query, err := s.getReadSelect(r)
	if err != nil {
		return nil, err
	}

	if false { // TODO, MYSQL/PosgreSQL can lock the row " FOR UPDATE"
		query += " FOR UPDATE"
	}

	query += " FROM " + table +
		" WHERE " + strings.Join(where, " AND ")

	s.log.Debug("read", "query", query, "args", args)

	rows, err := tx.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return &entity.Entity{}, nil
	}

	return s.rowToEntity(ctx, rows, r.WithBody, r.WithStatus)
}

func (s *sqlEntityServer) BatchRead(ctx context.Context, b *entity.BatchReadEntityRequest) (*entity.BatchReadEntityResponse, error) {
	if len(b.Batch) < 1 {
		return nil, fmt.Errorf("missing querires")
	}

	first := b.Batch[0]
	args := []any{}
	constraints := []string{}

	for _, r := range b.Batch {
		if r.WithBody != first.WithBody || r.WithStatus != first.WithStatus {
			return nil, fmt.Errorf("requests must want the same things")
		}

		if r.Key == "" {
			return nil, fmt.Errorf("missing key")
		}

		constraints = append(constraints, s.dialect.Quote("key")+"=?")
		args = append(args, r.Key)

		if r.ResourceVersion != 0 {
			return nil, fmt.Errorf("version not supported for batch read (yet?)")
		}
	}

	req := b.Batch[0]
	query, err := s.getReadSelect(req)
	if err != nil {
		return nil, err
	}

	query += " FROM entity" +
		" WHERE (" + strings.Join(constraints, " OR ") + ")"
	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	// TODO? make sure the results are in order?
	rsp := &entity.BatchReadEntityResponse{}
	for rows.Next() {
		r, err := s.rowToEntity(ctx, rows, req.WithBody, req.WithStatus)
		if err != nil {
			return nil, err
		}
		rsp.Results = append(rsp.Results, r)
	}
	return rsp, nil
}

//nolint:gocyclo
func (s *sqlEntityServer) Create(ctx context.Context, r *entity.CreateEntityRequest) (*entity.CreateEntityResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	createdAt := r.Entity.CreatedAt
	if createdAt < 1000 {
		createdAt = time.Now().UnixMilli()
	}

	createdBy := r.Entity.CreatedBy
	if createdBy == "" {
		modifier, err := appcontext.User(ctx)
		if err != nil {
			return nil, err
		}
		if modifier == nil {
			return nil, fmt.Errorf("can not find user in context")
		}
		createdBy = store.GetUserIDString(modifier)
	}

	updatedAt := r.Entity.UpdatedAt
	updatedBy := r.Entity.UpdatedBy

	rsp := &entity.CreateEntityResponse{
		Entity: &entity.Entity{},
		Status: entity.CreateEntityResponse_CREATED, // Will be changed if not true
	}

	err := s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		current, err := s.read(ctx, tx, &entity.ReadEntityRequest{
			Key:        r.Entity.Key,
			WithBody:   true,
			WithStatus: true,
		})
		if err != nil {
			return err
		}

		// if we found an existing entity
		if current.Guid != "" {
			return fmt.Errorf("entity already exists")
		}

		// generate guid for new entity
		current.Guid = uuid.New().String()

		// set created at/by
		current.CreatedAt = createdAt
		current.CreatedBy = createdBy

		// parse provided key
		key, err := entity.ParseKey(r.Entity.Key)
		if err != nil {
			return err
		}

		current.Key = r.Entity.Key
		current.Namespace = key.Namespace
		current.Group = key.Group
		current.GroupVersion = r.Entity.GroupVersion
		current.Resource = key.Resource
		current.Name = key.Name

		if r.Entity.Folder != "" {
			current.Folder = r.Entity.Folder
		}
		if r.Entity.Slug != "" {
			current.Slug = r.Entity.Slug
		}

		if r.Entity.Body != nil {
			current.Body = r.Entity.Body
			current.Size = int64(len(current.Body))
		}

		if r.Entity.Meta != nil {
			current.Meta = r.Entity.Meta
		}

		if r.Entity.Status != nil {
			current.Status = r.Entity.Status
		}

		etag := createContentsHash(current.Body, current.Meta, current.Status)
		current.ETag = etag

		current.UpdatedAt = updatedAt
		current.UpdatedBy = updatedBy

		if r.Entity.Title != "" {
			current.Title = r.Entity.Title
		}
		if r.Entity.Description != "" {
			current.Description = r.Entity.Description
		}

		labels, err := json.Marshal(r.Entity.Labels)
		if err != nil {
			s.log.Error("error marshalling labels", "msg", err.Error())
			return err
		}
		current.Labels = r.Entity.Labels

		fields, err := json.Marshal(r.Entity.Fields)
		if err != nil {
			s.log.Error("error marshalling fields", "msg", err.Error())
			return err
		}
		current.Fields = r.Entity.Fields

		errors, err := json.Marshal(r.Entity.Errors)
		if err != nil {
			s.log.Error("error marshalling errors", "msg", err.Error())
			return err
		}
		current.Errors = r.Entity.Errors

		if current.Origin == nil {
			current.Origin = &entity.EntityOriginInfo{}
		}

		if r.Entity.Origin != nil {
			if r.Entity.Origin.Source != "" {
				current.Origin.Source = r.Entity.Origin.Source
			}
			if r.Entity.Origin.Key != "" {
				current.Origin.Key = r.Entity.Origin.Key
			}
			if r.Entity.Origin.Time > 0 {
				current.Origin.Time = r.Entity.Origin.Time
			}
		}

		// Set the comment on this write
		if r.Entity.Message != "" {
			current.Message = r.Entity.Message
		}

		// Update resource version
		current.ResourceVersion = s.snowflake.Generate().Int64()

		values := map[string]any{
			"guid":             current.Guid,
			"key":              current.Key,
			"namespace":        current.Namespace,
			"group":            current.Group,
			"resource":         current.Resource,
			"name":             current.Name,
			"created_at":       current.CreatedAt,
			"created_by":       current.CreatedBy,
			"group_version":    current.GroupVersion,
			"folder":           current.Folder,
			"slug":             current.Slug,
			"updated_at":       current.UpdatedAt,
			"updated_by":       current.UpdatedBy,
			"body":             current.Body,
			"meta":             current.Meta,
			"status":           current.Status,
			"size":             current.Size,
			"etag":             current.ETag,
			"resource_version": current.ResourceVersion,
			"title":            current.Title,
			"description":      current.Description,
			"labels":           labels,
			"fields":           fields,
			"errors":           errors,
			"origin":           current.Origin.Source,
			"origin_key":       current.Origin.Key,
			"origin_ts":        current.Origin.Time,
			"message":          current.Message,
			"action":           entity.Entity_CREATED,
		}

		// 1. Add row to the `entity_history` values
		if err := s.dialect.Insert(ctx, tx, "entity_history", values); err != nil {
			s.log.Error("error inserting entity history", "msg", err.Error())
			return err
		}

		// 2. Add row to the main `entity` table
		if err := s.dialect.Insert(ctx, tx, "entity", values); err != nil {
			s.log.Error("error inserting entity", "msg", err.Error())
			return err
		}

		switch current.Group {
		case folder.GROUP:
			switch current.Resource {
			case folder.RESOURCE:
				err = s.updateFolderTree(ctx, tx, current.Namespace)
				if err != nil {
					s.log.Error("error updating folder tree", "msg", err.Error())
					return err
				}
			}
		}

		rsp.Entity = current

		return s.setLabels(ctx, tx, current.Guid, current.Labels)
	})
	if err != nil {
		s.log.Error("error creating entity", "msg", err.Error())
		rsp.Status = entity.CreateEntityResponse_ERROR
	}

	return rsp, err
}

//nolint:gocyclo
func (s *sqlEntityServer) Update(ctx context.Context, r *entity.UpdateEntityRequest) (*entity.UpdateEntityResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	updatedAt := r.Entity.UpdatedAt
	if updatedAt < 1000 {
		updatedAt = time.Now().UnixMilli()
	}

	updatedBy := r.Entity.UpdatedBy
	if updatedBy == "" {
		modifier, err := appcontext.User(ctx)
		if err != nil {
			return nil, err
		}
		if modifier == nil {
			return nil, fmt.Errorf("can not find user in context")
		}
		updatedBy = store.GetUserIDString(modifier)
	}

	rsp := &entity.UpdateEntityResponse{
		Entity: &entity.Entity{},
		Status: entity.UpdateEntityResponse_UPDATED, // Will be changed if not true
	}

	err := s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		current, err := s.read(ctx, tx, &entity.ReadEntityRequest{
			Key:        r.Entity.Key,
			WithBody:   true,
			WithStatus: true,
		})
		if err != nil {
			return err
		}

		// Optimistic locking
		if r.PreviousVersion > 0 && r.PreviousVersion != current.ResourceVersion {
			return fmt.Errorf("optimistic lock failed")
		}

		// if we didn't find an existing entity
		if current.Guid == "" {
			return fmt.Errorf("entity not found")
		}

		rsp.Entity.Guid = current.Guid

		// Clear the refs
		if _, err := tx.Exec(ctx, "DELETE FROM entity_ref WHERE guid=?", rsp.Entity.Guid); err != nil {
			return err
		}

		if r.Entity.GroupVersion != "" {
			current.GroupVersion = r.Entity.GroupVersion
		}

		if r.Entity.Folder != "" {
			current.Folder = r.Entity.Folder
		}
		if r.Entity.Slug != "" {
			current.Slug = r.Entity.Slug
		}

		if r.Entity.Body != nil {
			current.Body = r.Entity.Body
			current.Size = int64(len(current.Body))
		}

		if r.Entity.Meta != nil {
			current.Meta = r.Entity.Meta
		}

		if r.Entity.Status != nil {
			current.Status = r.Entity.Status
		}

		etag := createContentsHash(current.Body, current.Meta, current.Status)
		current.ETag = etag

		current.UpdatedAt = updatedAt
		current.UpdatedBy = updatedBy

		if r.Entity.Title != "" {
			current.Title = r.Entity.Title
		}
		if r.Entity.Description != "" {
			current.Description = r.Entity.Description
		}

		labels, err := json.Marshal(r.Entity.Labels)
		if err != nil {
			s.log.Error("error marshalling labels", "msg", err.Error())
			return err
		}
		current.Labels = r.Entity.Labels

		fields, err := json.Marshal(r.Entity.Fields)
		if err != nil {
			s.log.Error("error marshalling fields", "msg", err.Error())
			return err
		}
		current.Fields = r.Entity.Fields

		errors, err := json.Marshal(r.Entity.Errors)
		if err != nil {
			s.log.Error("error marshalling errors", "msg", err.Error())
			return err
		}
		current.Errors = r.Entity.Errors

		if current.Origin == nil {
			current.Origin = &entity.EntityOriginInfo{}
		}

		if r.Entity.Origin != nil {
			if r.Entity.Origin.Source != "" {
				current.Origin.Source = r.Entity.Origin.Source
			}
			if r.Entity.Origin.Key != "" {
				current.Origin.Key = r.Entity.Origin.Key
			}
			if r.Entity.Origin.Time > 0 {
				current.Origin.Time = r.Entity.Origin.Time
			}
		}

		// Set the comment on this write
		if r.Entity.Message != "" {
			current.Message = r.Entity.Message
		}

		// Update resource version
		current.ResourceVersion = s.snowflake.Generate().Int64()

		values := map[string]any{
			// below are only set in history table
			"guid":       current.Guid,
			"key":        current.Key,
			"namespace":  current.Namespace,
			"group":      current.Group,
			"resource":   current.Resource,
			"name":       current.Name,
			"created_at": current.CreatedAt,
			"created_by": current.CreatedBy,
			// below are updated
			"group_version":    current.GroupVersion,
			"folder":           current.Folder,
			"slug":             current.Slug,
			"updated_at":       current.UpdatedAt,
			"updated_by":       current.UpdatedBy,
			"body":             current.Body,
			"meta":             current.Meta,
			"status":           current.Status,
			"size":             current.Size,
			"etag":             current.ETag,
			"resource_version": current.ResourceVersion,
			"title":            current.Title,
			"description":      current.Description,
			"labels":           labels,
			"fields":           fields,
			"errors":           errors,
			"origin":           current.Origin.Source,
			"origin_key":       current.Origin.Key,
			"origin_ts":        current.Origin.Time,
			"message":          current.Message,
			"action":           entity.Entity_UPDATED,
		}

		// 1. Add the `entity_history` values
		if err := s.dialect.Insert(ctx, tx, "entity_history", values); err != nil {
			s.log.Error("error inserting entity history", "msg", err.Error())
			return err
		}

		// 2. update the main `entity` table

		// remove values that are only set at insert
		delete(values, "guid")
		delete(values, "key")
		delete(values, "namespace")
		delete(values, "group")
		delete(values, "resource")
		delete(values, "name")
		delete(values, "created_at")
		delete(values, "created_by")
		delete(values, "action")

		err = s.dialect.Update(
			ctx,
			tx,
			"entity",
			values,
			map[string]any{
				"guid": current.Guid,
			},
		)
		if err != nil {
			s.log.Error("error updating entity", "msg", err.Error())
			return err
		}

		switch current.Group {
		case folder.GROUP:
			switch current.Resource {
			case folder.RESOURCE:
				err = s.updateFolderTree(ctx, tx, current.Namespace)
				if err != nil {
					s.log.Error("error updating folder tree", "msg", err.Error())
					return err
				}
			}
		}

		rsp.Entity = current

		return s.setLabels(ctx, tx, current.Guid, current.Labels)
	})
	if err != nil {
		s.log.Error("error updating entity", "msg", err.Error())
		rsp.Status = entity.UpdateEntityResponse_ERROR
	}

	return rsp, err
}

func (s *sqlEntityServer) setLabels(ctx context.Context, tx *session.SessionTx, guid string, labels map[string]string) error {
	s.log.Debug("setLabels", "guid", guid, "labels", labels)

	// Clear the old labels
	if _, err := tx.Exec(ctx, "DELETE FROM entity_labels WHERE guid=?", guid); err != nil {
		return err
	}

	// Add the new labels
	for k, v := range labels {
		query, args, err := s.dialect.InsertQuery(
			"entity_labels",
			map[string]any{
				"guid":  guid,
				"label": k,
				"value": v,
			},
		)
		if err != nil {
			return err
		}

		_, err = tx.Exec(ctx, query, args...)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *sqlEntityServer) Delete(ctx context.Context, r *entity.DeleteEntityRequest) (*entity.DeleteEntityResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	rsp := &entity.DeleteEntityResponse{}

	err := s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		var err error
		rsp.Entity, err = s.Read(ctx, &entity.ReadEntityRequest{
			Key:        r.Key,
			WithBody:   true,
			WithStatus: true,
		})
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				rsp.Status = entity.DeleteEntityResponse_NOTFOUND
			} else {
				rsp.Status = entity.DeleteEntityResponse_ERROR
			}
			return err
		}

		if r.PreviousVersion > 0 && r.PreviousVersion != rsp.Entity.ResourceVersion {
			rsp.Status = entity.DeleteEntityResponse_ERROR
			return fmt.Errorf("optimistic lock failed")
		}

		err = s.doDelete(ctx, tx, rsp.Entity)
		if err != nil {
			rsp.Status = entity.DeleteEntityResponse_ERROR
			return err
		}

		rsp.Status = entity.DeleteEntityResponse_DELETED
		return nil
	})

	return rsp, err
}

func (s *sqlEntityServer) doDelete(ctx context.Context, tx *session.SessionTx, ent *entity.Entity) error {
	// Update resource version
	ent.ResourceVersion = s.snowflake.Generate().Int64()

	labels, err := json.Marshal(ent.Labels)
	if err != nil {
		s.log.Error("error marshalling labels", "msg", err.Error())
		return err
	}

	fields, err := json.Marshal(ent.Fields)
	if err != nil {
		s.log.Error("error marshalling fields", "msg", err.Error())
		return err
	}

	errors, err := json.Marshal(ent.Errors)
	if err != nil {
		s.log.Error("error marshalling errors", "msg", err.Error())
		return err
	}

	values := map[string]any{
		// below are only set in history table
		"guid":       ent.Guid,
		"key":        ent.Key,
		"namespace":  ent.Namespace,
		"group":      ent.Group,
		"resource":   ent.Resource,
		"name":       ent.Name,
		"created_at": ent.CreatedAt,
		"created_by": ent.CreatedBy,
		// below are updated
		"group_version":    ent.GroupVersion,
		"folder":           ent.Folder,
		"slug":             ent.Slug,
		"updated_at":       ent.UpdatedAt,
		"updated_by":       ent.UpdatedBy,
		"body":             ent.Body,
		"meta":             ent.Meta,
		"status":           ent.Status,
		"size":             ent.Size,
		"etag":             ent.ETag,
		"resource_version": ent.ResourceVersion,
		"title":            ent.Title,
		"description":      ent.Description,
		"labels":           labels,
		"fields":           fields,
		"errors":           errors,
		"origin":           ent.Origin.Source,
		"origin_key":       ent.Origin.Key,
		"origin_ts":        ent.Origin.Time,
		"message":          ent.Message,
		"action":           entity.Entity_DELETED,
	}

	// 1. Add the `entity_history` values
	if err := s.dialect.Insert(ctx, tx, "entity_history", values); err != nil {
		s.log.Error("error inserting entity history", "msg", err.Error())
		return err
	}

	_, err = tx.Exec(ctx, "DELETE FROM entity WHERE guid=?", ent.Guid)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, "DELETE FROM entity_labels WHERE guid=?", ent.Guid)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, "DELETE FROM entity_ref WHERE guid=?", ent.Guid)
	if err != nil {
		return err
	}

	switch ent.Group {
	case folder.GROUP:
		switch ent.Resource {
		case folder.RESOURCE:
			err = s.updateFolderTree(ctx, tx, ent.Namespace)
			if err != nil {
				s.log.Error("error updating folder tree", "msg", err.Error())
				return err
			}
		}
	}

	return nil
}

func (s *sqlEntityServer) History(ctx context.Context, r *entity.EntityHistoryRequest) (*entity.EntityHistoryResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	var limit int64 = 100
	if r.Limit > 0 && r.Limit < 100 {
		limit = r.Limit
	}

	rr := &entity.ReadEntityRequest{
		Key:        r.Key,
		WithBody:   true,
		WithStatus: true,
	}

	query, err := s.getReadSelect(rr)
	if err != nil {
		return nil, err
	}

	if r.Key == "" {
		return nil, fmt.Errorf("missing key")
	}

	key, err := entity.ParseKey(r.Key)
	if err != nil {
		return nil, err
	}

	where := []string{}
	args := []any{}

	where = append(where, s.dialect.Quote("namespace")+"=?", s.dialect.Quote("group")+"=?", s.dialect.Quote("resource")+"=?", s.dialect.Quote("name")+"=?")
	args = append(args, key.Namespace, key.Group, key.Resource, key.Name)

	if r.NextPageToken != "" {
		if true {
			return nil, fmt.Errorf("tokens not yet supported")
		}
		where = append(where, "version <= ?")
		args = append(args, r.NextPageToken)
	}

	query += " FROM entity_history" +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY resource_version DESC" +
		// select 1 more than we need to see if there is a next page
		" LIMIT " + fmt.Sprint(limit+1)

	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	rsp := &entity.EntityHistoryResponse{
		Key: r.Key,
	}
	for rows.Next() {
		v, err := s.rowToEntity(ctx, rows, rr.WithBody, rr.WithStatus)
		if err != nil {
			return nil, err
		}

		// found more than requested
		if int64(len(rsp.Versions)) >= limit {
			rsp.NextPageToken = fmt.Sprintf("rv:%d", v.ResourceVersion)
			break
		}

		rsp.Versions = append(rsp.Versions, v)
	}
	return rsp, err
}

type ContinueToken struct {
	Sort        []string `json:"s"`
	StartOffset int64    `json:"o"`
}

func (c *ContinueToken) String() string {
	b, _ := json.Marshal(c)
	return base64.StdEncoding.EncodeToString(b)
}

func GetContinueToken(r *entity.EntityListRequest) (*ContinueToken, error) {
	if r.NextPageToken == "" {
		return nil, nil
	}

	continueVal, err := base64.StdEncoding.DecodeString(r.NextPageToken)
	if err != nil {
		return nil, fmt.Errorf("error decoding continue token")
	}

	t := &ContinueToken{}
	err = json.Unmarshal(continueVal, t)
	if err != nil {
		return nil, err
	}

	if !slices.Equal(t.Sort, r.Sort) {
		return nil, fmt.Errorf("sort order changed")
	}

	return t, nil
}

var sortByFields = []string{
	"guid",
	"key",
	"namespace", "group", "group_version", "resource", "name", "folder",
	"resource_version", "size", "etag",
	"created_at", "created_by",
	"updated_at", "updated_by",
	"origin", "origin_key", "origin_ts",
	"title", "slug", "description",
}

type SortBy struct {
	Field     string
	Direction Direction
}

func ParseSortBy(sort string) (*SortBy, error) {
	sortBy := &SortBy{
		Field:     "guid",
		Direction: Ascending,
	}

	if strings.HasSuffix(sort, "_desc") {
		sortBy.Field = sort[:len(sort)-5]
		sortBy.Direction = Descending
	} else {
		sortBy.Field = sort
	}

	if !slices.Contains(sortByFields, sortBy.Field) {
		return nil, fmt.Errorf("invalid sort field '%s', valid fields: %v", sortBy.Field, sortByFields)
	}

	return sortBy, nil
}

func (s *sqlEntityServer) List(ctx context.Context, r *entity.EntityListRequest) (*entity.EntityListResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("missing user in context")
	}

	rr := &entity.ReadEntityRequest{
		WithBody:   r.WithBody,
		WithStatus: r.WithStatus,
	}

	fields := s.getReadFields(rr)

	entityQuery := selectQuery{
		dialect:  s.dialect,
		fields:   fields,
		from:     "entity", // the table
		args:     []any{},
		limit:    r.Limit,
		offset:   0,
		oneExtra: true, // request one more than the limit (and show next token if it exists)
	}

	// TODO fix this
	// entityQuery.addWhere("namespace", user.OrgID)

	if len(r.Group) > 0 {
		entityQuery.addWhereIn("group", r.Group)
	}

	if len(r.Resource) > 0 {
		entityQuery.addWhereIn("resource", r.Resource)
	}

	if len(r.Key) > 0 {
		where := []string{}
		args := []any{}
		for _, k := range r.Key {
			key, err := entity.ParseKey(k)
			if err != nil {
				return nil, err
			}

			args = append(args, key.Namespace, key.Group, key.Resource)
			whereclause := "(" + s.dialect.Quote("namespace") + "=? AND " + s.dialect.Quote("group") + "=? AND " + s.dialect.Quote("resource") + "=?"
			if key.Name != "" {
				args = append(args, key.Name)
				whereclause += " AND " + s.dialect.Quote("name") + "=?"
			}
			whereclause += ")"

			where = append(where, whereclause)
		}

		entityQuery.addWhere("("+strings.Join(where, " OR ")+")", args...)
	}

	// Folder guid
	if r.Folder != "" {
		entityQuery.addWhere("folder", r.Folder)
	}

	// if we have a page token, use that to specify the first record
	continueToken, err := GetContinueToken(r)
	if err != nil {
		return nil, err
	}
	if continueToken != nil {
		entityQuery.offset = continueToken.StartOffset
	}

	if len(r.Labels) > 0 {
		var args []any
		var conditions []string
		for labelKey, labelValue := range r.Labels {
			args = append(args, labelKey)
			args = append(args, labelValue)
			conditions = append(conditions, "(label = ? AND value = ?)")
		}
		query := "SELECT guid FROM entity_labels" +
			" WHERE (" + strings.Join(conditions, " OR ") + ")" +
			" GROUP BY guid" +
			" HAVING COUNT(label) = ?"
		args = append(args, len(r.Labels))

		entityQuery.addWhereInSubquery("guid", query, args)
	}
	for _, sort := range r.Sort {
		sortBy, err := ParseSortBy(sort)
		if err != nil {
			return nil, err
		}
		entityQuery.addOrderBy(sortBy.Field, sortBy.Direction)
	}
	entityQuery.addOrderBy("guid", Ascending)

	query, args := entityQuery.toQuery()

	s.log.Debug("listing", "query", query, "args", args)

	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	rsp := &entity.EntityListResponse{}
	for rows.Next() {
		result, err := s.rowToEntity(ctx, rows, rr.WithBody, rr.WithStatus)
		if err != nil {
			return rsp, err
		}

		// found more than requested
		if int64(len(rsp.Results)) >= entityQuery.limit {
			continueToken := &ContinueToken{
				Sort:        r.Sort,
				StartOffset: entityQuery.offset + entityQuery.limit,
			}
			rsp.NextPageToken = continueToken.String()
			break
		}

		rsp.Results = append(rsp.Results, result)
	}

	return rsp, err
}

func (s *sqlEntityServer) Watch(r *entity.EntityWatchRequest, w entity.EntityStore_WatchServer) error {
	if err := s.Init(); err != nil {
		return err
	}

	user, err := appcontext.User(w.Context())
	if err != nil {
		return err
	}
	if user == nil {
		return fmt.Errorf("missing user in context")
	}

	// process the request and cache derived information
	cr, err := newCachedEntityWatchRequest(r, "default") // TODO: user.OrgID
	if err != nil {
		return err
	}

	// collect and send any historical events
	err = s.watchInit(w.Context(), cr, w)
	if err != nil {
		return err
	}

	engine, err := s.db.GetEngine()
	if err != nil {
		return fmt.Errorf("get engine: %w", err)
	}

	// subscribe to new events
	if engine.DriverName() == "postgres" {
		err = s.watch(w.Context(), cr, w)
	} else {
		err = s.pgWatch(w.Context(), cr, w)
	}
	if err != nil {
		s.log.Error("watch error", "err", err)
		return err
	}

	return nil
}

// cachedEntityWatchRequest embeds an entity.EntityWatchRequest and holds some calculated
// information for consistency and efficiency
type cachedEntityWatchRequest struct {
	*entity.EntityWatchRequest
	keys      []*entity.Key
	namespace string
}

func newCachedEntityWatchRequest(r *entity.EntityWatchRequest, namespace string) (cachedEntityWatchRequest, error) {
	ret := cachedEntityWatchRequest{
		EntityWatchRequest: r,
		namespace:          namespace,
	}

	if len(r.Key) > 0 {
		ret.keys = make([]*entity.Key, len(r.Key))
		for i, k := range r.Key {
			key, err := entity.ParseKey(k)
			if err != nil {
				return ret, fmt.Errorf("parse %d-eth key: %w", i, err)
			}
			if key.Namespace != "" && key.Namespace != namespace {
				return ret, fmt.Errorf("namespace %q in %d-eth key: %w", key.Namespace, i, ErrUnauthorizedNamespace)
			}
			ret.keys[i] = key
		}
	}

	return ret, nil
}

// watchInit is a helper function to send the initial set of entities to the client
func (s *sqlEntityServer) watchInit(ctx context.Context, r cachedEntityWatchRequest, w entity.EntityStore_WatchServer) error {
	rr := &entity.ReadEntityRequest{
		WithBody:   r.WithBody,
		WithStatus: r.WithStatus,
	}

	fields := s.getReadFields(rr)

	entityQuery := selectQuery{
		dialect:  s.dialect,
		fields:   fields,
		from:     "entity", // the table
		args:     []any{},
		limit:    100,  // r.Limit,
		oneExtra: true, // request one more than the limit (and show next token if it exists)
	}

	// if we got an initial resource version, start from that location in the history
	fromZero := true
	if r.Since > 0 {
		entityQuery.from = "entity_history"
		entityQuery.addWhere("resource_version > ?", r.Since)
		fromZero = false
	}

	// TODO fix this
	// entityQuery.addWhere("namespace", user.OrgID)

	if len(r.Resource) > 0 {
		entityQuery.addWhereIn("resource", r.Resource)
	}

	if len(r.keys) > 0 {
		where := []string{}
		args := []any{}
		for _, key := range r.keys {
			args = append(args, key.Namespace, key.Group, key.Resource)
			whereclause := "(" + s.dialect.Quote("namespace") + "=? AND " + s.dialect.Quote("group") + "=? AND " + s.dialect.Quote("resource") + "=?"
			if key.Name != "" {
				args = append(args, key.Name)
				whereclause += " AND " + s.dialect.Quote("name") + "=?"
			}
			whereclause += ")"

			where = append(where, whereclause)
		}

		entityQuery.addWhere("("+strings.Join(where, " OR ")+")", args...)
	}

	// Folder guid
	if r.Folder != "" {
		entityQuery.addWhere("folder", r.Folder)
	}

	if len(r.Labels) > 0 {
		var args []any
		var conditions []string
		for labelKey, labelValue := range r.Labels {
			args = append(args, labelKey)
			args = append(args, labelValue)
			conditions = append(conditions, "(label = ? AND value = ?)")
		}
		query := "SELECT guid FROM entity_labels" +
			" WHERE (" + strings.Join(conditions, " OR ") + ")" +
			" GROUP BY guid" +
			" HAVING COUNT(label) = ?"
		args = append(args, len(r.Labels))

		entityQuery.addWhereInSubquery("guid", query, args)
	}

	entityQuery.addOrderBy("resource_version", Ascending)

	var err error

	s.log.Debug("watch init", "since", r.Since)

	for hasmore := true; hasmore; {
		err = func() error {
			query, args := entityQuery.toQuery()

			rows, err := s.sess.Query(ctx, query, args...)
			if err != nil {
				return err
			}
			defer func() { _ = rows.Close() }()

			found := int64(0)

			for rows.Next() {
				found++
				if found > entityQuery.limit {
					entityQuery.offset += entityQuery.limit
					return nil
				}

				result, err := s.rowToEntity(ctx, rows, rr.WithBody, rr.WithStatus)
				if err != nil {
					return err
				}

				if result.ResourceVersion > r.Since {
					r.Since = result.ResourceVersion
				}

				if fromZero {
					result.Action = entity.Entity_CREATED
				}

				s.log.Debug("sending init event", "guid", result.Guid, "action", result.Action, "rv", result.ResourceVersion)
				err = w.Send(&entity.EntityWatchResponse{
					Timestamp: time.Now().UnixMilli(),
					Entity:    result,
				})
				if err != nil {
					return err
				}
			}

			hasmore = false
			return nil
		}()
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *sqlEntityServer) poller(stream chan *entity.Entity) {
	var err error
	since := s.snowflake.Generate().Int64()

	t := time.NewTicker(5 * time.Second)
	defer t.Stop()

	for range t.C {
		since, err = s.poll(context.Background(), since, stream)
		if err != nil {
			s.log.Error("watch error", "err", err)
		}
	}
}

func (s *sqlEntityServer) poll(ctx context.Context, since int64, out chan *entity.Entity) (int64, error) {
	s.log.Debug("watch poll", "since", since)

	rr := &entity.ReadEntityRequest{
		WithBody:   true,
		WithStatus: true,
	}

	fields := s.getReadFields(rr)

	for hasmore := true; hasmore; {
		err := func() error {
			entityQuery := selectQuery{
				dialect: s.dialect,
				fields:  fields,
				from:    "entity_history", // the table
				args:    []any{},
				limit:   100, // r.Limit,
				// offset:   0,
				oneExtra: true, // request one more than the limit (and show next token if it exists)
				orderBy:  []string{"resource_version"},
			}

			entityQuery.addWhere("resource_version > ?", since)

			query, args := entityQuery.toQuery()

			rows, err := s.sess.Query(ctx, query, args...)
			if err != nil {
				return err
			}
			defer func() { _ = rows.Close() }()

			found := int64(0)
			for rows.Next() {
				found++
				if found > entityQuery.limit {
					return nil
				}

				result, err := s.rowToEntity(ctx, rows, rr.WithBody, rr.WithStatus)
				if err != nil {
					return err
				}

				if result.ResourceVersion > since {
					since = result.ResourceVersion
				}

				s.log.Debug("sending poll result", "guid", result.Guid, "action", result.Action, "rv", result.ResourceVersion)
				out <- result
			}

			hasmore = false
			return nil
		}()
		if err != nil {
			return since, err
		}
	}

	return since, nil
}

func watchMatches(r cachedEntityWatchRequest, result *entity.Entity) bool {
	// Resource version too old
	if result.ResourceVersion <= r.Since {
		return false
	}

	// Folder guid
	if r.Folder != "" && r.Folder != result.Folder {
		return false
	}

	// must match at least one resource if specified
	if len(r.Resource) > 0 {
		matched := false
		for _, res := range r.Resource {
			if res == result.Resource {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// must match at least one key if specified
	if len(r.keys) > 0 {
		matched := false
		for _, key := range r.keys {
			if key.Namespace == result.Namespace && key.Group == result.Group && key.Resource == result.Resource && (key.Name == "" || key.Name == result.Name) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// must match at least one label/value pair if specified
	// TODO should this require matching all label conditions?
	if len(r.Labels) > 0 {
		matched := false
		for labelKey, labelValue := range r.Labels {
			if result.Labels[labelKey] == labelValue {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	return true
}

// notifiedEntity holds the JSON payload that the postgres notification payload contains, and it is used to discard
// uninteresting rows. The JSON payload is built in a trigger on "entity" table, and passed to the postgres NOTIFY
// command so we receive it here.
type notifiedEntity struct {
	GUID string `json:"guid"` // Used to retrieve the full row from "entity_history" by its primary key

	// Fields used to discriminate (un)interesting notifications
	Group           string `json:"group"`
	Name            string `json:"name"`
	Resource        string `json:"resource"`
	ResourceVersion string `json:"resource_version"`
	Folder          string `json:"folder"`
	Labels          string `json:"labels"`
}

// toEntity converts the payload from an entity notification to a partially populated *entity.Entity, enough to be able
// to call watchMatches on it.
func (ne notifiedEntity) toEntity(namespace string) (*entity.Entity, error) {
	ret := &entity.Entity{
		Guid:      ne.GUID,
		Group:     ne.Group,
		Name:      ne.Name,
		Resource:  ne.Resource,
		Namespace: namespace,
		Folder:    ne.Folder,
	}

	v, err := strconv.ParseInt(ne.ResourceVersion, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("decode resource version: %w", err)
	}
	ret.ResourceVersion = v

	// unmarshal json labels
	if ne.Labels != "" {
		if err := json.NewDecoder(strings.NewReader(ne.Labels)).Decode(&ret.Labels); err != nil {
			return nil, fmt.Errorf("decode labels: %w", err)
		}
	}

	return ret, nil
}

// pgTerminateListener closes the connection used for postgres notifications, terminates all watchers and resets the
// state to be ready again for new watchers. Current watchers will return ErrPgWatchTerminated error.
func (s *sqlEntityServer) pgTerminateListener() error {
	s.pgListenerMu.Lock()
	defer s.pgListenerMu.Unlock()
	if s.pgListener == nil {
		return ErrPgListenerNotInit
	}

	// closing the pg listener will cause the pg notification Go channel to be closed,
	// which will cause the broker goroutine to exit
	err := s.pgListener.Close()

	// wait until the broker goroutine has completed
	<-s.pgBrokerDone

	// cleanup
	s.pgTerminateWatchers()
	s.pgListener = nil
	s.pgBrokerDone = nil

	return err
}

// pgGetListener returns the *pq.Listener used for postgres notifications, initializing it if necessary.
func (s *sqlEntityServer) pgGetListener() (*pq.Listener, error) {
	s.pgListenerMu.RLock()
	l := s.pgListener
	s.pgListenerMu.RUnlock()

	if l != nil {
		return l, nil
	}

	// initialize

	s.pgListenerMu.Lock()
	defer s.pgListenerMu.Unlock()
	engine, err := s.db.GetEngine()
	if err != nil {
		return nil, fmt.Errorf("get engine: %w", err)
	}

	if dn := engine.DriverName(); dn != "postgres" {
		return nil, fmt.Errorf("unexpected driver %q: %w", dn, ErrNotPostgresDriver)
	}

	// TODO: provide a non-nil func to collect reconnection metrics
	l = pq.NewListener(engine.DataSourceName(), s.pgListenerMinReconnectInterval, s.pgListenerMaxReconnectInterval, nil)
	if err = l.Ping(); err != nil {
		return nil, err
	}

	s.pgBrokerDone = make(chan struct{})
	s.pgListener = l

	go s.pgNotificationBrokerLoop(l.Notify)

	return l, nil
}

// pgAddNotifyChan registers the given Go channel for the postgres notification broker to direct relevant notifications to
// it. The pointer it returns is used as an ID (or handle) to remove the channel with pgRemoveNotifyChan when the calling
// function no longer needs to receive notifications. The postgres channel name is the k8s namespace, and is directly
// associated with the tenant id.
func (s *sqlEntityServer) pgAddNotifyChan(pgChannelName string, c chan<- *pq.Notification) (pgWatcherChannelMapKey, error) {
	s.pgNotifyMapMu.Lock()
	defer s.pgNotifyMapMu.Unlock()

	if s.pgNotifyMap == nil {
		s.pgNotifyMap = pgChannelMap{}

	} else if _, ok := s.pgNotifyMap[pgChannelName]; !ok {
		s.pgNotifyMap[pgChannelName] = pgWatcherChannelMap{}
		// we weren't listening before, so we start listening
		l, err := s.pgGetListener()
		if err != nil {
			return nil, fmt.Errorf("pg get listener: %w", err)
		}
		if err = l.Listen(pgChannelName); err != nil {
			return nil, fmt.Errorf("pg listen on channel %q: %w", pgChannelName, err)
		}
	}

	watcherKey := new(byte)
	s.pgNotifyMap[pgChannelName][watcherKey] = c

	return watcherKey, nil
}

// pgRemoveNotifyChan removes the channel associated with the given id (or handle). If either the pgChannelName or
// watcherKey are registered it becomes a nop.
func (s *sqlEntityServer) pgRemoveNotifyChan(pgChannelName string, watcherKey pgWatcherChannelMapKey) error {
	s.pgNotifyMapMu.Lock()
	defer s.pgNotifyMapMu.Unlock()
	return s.pgRemoveNotifyChanLocked(pgChannelName, watcherKey)
}

func (s *sqlEntityServer) pgRemoveNotifyChanLocked(pgChannelName string, watcherKey pgWatcherChannelMapKey) error {
	if s.pgNotifyMap == nil {
		return nil
	}

	// close the watcher channel and delete the entry from watcher channel map
	m := s.pgNotifyMap[pgChannelName]
	if m == nil {
		return nil
	}

	c := m[watcherKey]
	if c == nil {
		return nil
	}
	close(c)
	delete(m, watcherKey)

	// if the watcher channel map no longer has items, unlisten from that postgres channel and remove the entry from the
	// postgres channel map
	if len(m) == 0 {
		delete(s.pgNotifyMap, pgChannelName)
		l, err := s.pgGetListener()
		if err != nil {
			return fmt.Errorf("pg get listener: %w", err)
		}
		if err := l.Unlisten(pgChannelName); err != nil {
			return fmt.Errorf("pg unlisten on channel %q: %w", pgChannelName, err)
		}
	}

	return nil
}

// pgTerminateWatchers manually terminates all watchers, unlistens from all postgres channels and performs local state
// cleanup, but doesn't terminate the dedicated postgres listener connection. Current watchers will return
// ErrPgWatchTerminated error.
func (s *sqlEntityServer) pgTerminateWatchers() {
	s.pgNotifyMapMu.Lock()
	defer s.pgNotifyMapMu.Unlock()
	for c, m := range s.pgNotifyMap {
		for k := range m {
			if err := s.pgRemoveNotifyChanLocked(c, k); err != nil {
				s.log.Error("terminate all postgres watchers: %w", err)
			}
		}
	}
}

// pgNotificationBrokerLoop processes all the postgres server notifications sent to this server instance. As we use a
// single DB connection to handle all postgres notifications, we need this broker to send the notification to the
// appropriate running watcher.
func (s *sqlEntityServer) pgNotificationBrokerLoop(c <-chan *pq.Notification) {
	// signal that we have terminated, as this is meant to be run in a differnet goroutine
	defer close(s.pgBrokerDone)

	// main broker loop
	for {
		// get the next notification
		var n *pq.Notification
		var ok bool

		// TODO: add case with ticker, which requires importing clock for an effectively testable ticker implementation.
		// In the example code from the library they use 90 * time.Second for the ticker. For more information see:
		//	https://pkg.go.dev/github.com/lib/pq/example/listen
		select {
		case n, ok = <-c:
		}

		// when we close the postgres notification listener the channel is closed
		if !ok {
			break
		}

		// the listener could send a nil notification during reconnection, so discard it. For more information, see:
		//	https://pkg.go.dev/github.com/lib/pq#hdr-Notifications
		if n == nil {
			continue
		}

		s.pgNotificationBroker(n)
	}
}

// pgNotificationBroker spreads a notification over potentially interested watchers.
func (s *sqlEntityServer) pgNotificationBroker(n *pq.Notification) {
	s.pgNotifyMapMu.RLock()
	defer s.pgNotifyMapMu.RUnlock()
	for _, c := range s.pgNotifyMap[n.Channel] {
		// we non-blockingly send to each watcher channel. This is because we need to be able to handle larger amounts
		// notifications received. We cannot use a different goroutine to send to the channel here because if more than
		// one goroutine is blocked waiting to send to a channel, there is no guarantee of which goroutine will get to
		// send to the channel (this is by design in Go), which would cause some notifications to be dropped if they
		// arrive out of sequence. Instead, we provide an individual buffer for each watcher channel, which satisfies
		// our strict queueing needs. In the case that too many notifications are dropped, consider increasing
		// pgWatcherChannelBufferLen
		select {
		case c <- n:
		default:
			s.log.Error("postgres notification dropped due to filled watcher queue",
				"channel", n.Channel,
				"payload", n.Extra,
				"watcher_queue_capacity", cap(c))
		}
	}
}

// pgWatch is like watch but uses the native postgres LISTEN/NOTIFY SQL commands, and only queries for the rows we
// are sure we are interested in. Notifications include a payload which aids discriminating which are relevant to a
// watcher.
func (s *sqlEntityServer) pgWatch(ctx context.Context, r cachedEntityWatchRequest, w entity.EntityStore_WatchServer) error {
	// create a channel for the broker to send us the notifications we're interested in and register it
	c := make(chan *pq.Notification, s.pgWatcherChannelBufferLen)
	watcherKey, err := s.pgAddNotifyChan(r.namespace, c)
	if err != nil {
		return err
	}

	// cleanup
	defer func() {
		if err := s.pgRemoveNotifyChan(r.namespace, watcherKey); err != nil {
			s.log.Error("remove notify channel", "error", err)
		}
		close(c)
	}()

	// main notifications loop
loop:
	for {
		select {
		case <-ctx.Done():
			// NB: if you call `break` within a `select` statement you will break the select, so we need a label to
			// explicitly refer to the loop
			break loop

		case n, ok := <-c:
			if !ok {
				// we were terminated by pgTerminateWatchers
				return ErrPgWatchTerminated
			}

			// decode the notification payload
			var ne notifiedEntity
			if err := json.NewDecoder(strings.NewReader(n.Extra)).Decode(&ne); err != nil {
				s.log.Error("decode postgres notification from channel %q with JSON payload %q: %w", r.namespace, n.Extra, err)
				continue
			}

			// continue if we don't care about this notification
			partialEntity, err := ne.toEntity(r.namespace)
			if err != nil {
				s.log.Error("convert notification with payload %q to entity: %w", n.Extra, err)
				continue
			}
			if !watchMatches(r, partialEntity) {
				continue
			}

			// retrieve the full row from the database. We are using Query instead of Get method to reuse rowToEntity
			// for max consistency, but we are sure we cannot get more than one row since the `guid` field is the
			// primary key of the table
			rows, err := s.sess.Query(ctx, "SELECT * FROM entity_history WHERE guid = ?", ne.GUID)
			if err != nil {
				return fmt.Errorf("get from entity history by GUID %q: %w", ne.GUID, err)
			}
			defer rows.Close()

			// advance the rows iterator to retrieve the row
			if !rows.Next() {
				return fmt.Errorf("entity with GUID %q not found in history", ne.GUID)
			}

			// convert the row to entity
			result, err := s.rowToEntity(ctx, rows, r.WithBody, r.WithStatus)
			if err != nil {
				return fmt.Errorf("convert SQL row to entity with GUID %q: %w", ne.GUID, err)
			}

			// send the results to the client
			s.log.Debug("sending watch result", "guid", result.Guid, "action", result.Action)
			err = w.Send(&entity.EntityWatchResponse{
				Timestamp: time.Now().UnixMilli(),
				Entity:    result,
			})
			if err != nil {
				return fmt.Errorf("sending entity with GUID %q to client: %w", ne.GUID, err)
			}

			// update r.Since value so we don't send earlier results again
			r.Since = result.ResourceVersion
		}
	}

	return nil
}

// watch is a helper to get the next set of entities and send them to the client
func (s *sqlEntityServer) watch(ctx context.Context, r cachedEntityWatchRequest, w entity.EntityStore_WatchServer) error {
	s.log.Debug("watch started", "since", r.Since)

	evts, err := s.broadcaster.Subscribe(w.Context())
	if err != nil {
		return err
	}

	for {
		select {
		// user closed the connection
		case <-w.Context().Done():
			return nil
		// got a raw result from the broadcaster
		case result := <-evts:
			// result doesn't match our watch params, skip it
			if !watchMatches(r, result) {
				s.log.Debug("watch result not matched", "guid", result.Guid, "action", result.Action, "rv", result.ResourceVersion)
				break
			}

			// remove the body and status if not requested
			if !r.WithBody {
				result.Body = nil
			}
			if !r.WithStatus {
				result.Status = nil
			}

			// update r.Since value so we don't send earlier results again
			r.Since = result.ResourceVersion

			s.log.Debug("sending watch result", "guid", result.Guid, "action", result.Action, "rv", result.ResourceVersion)
			err = w.Send(&entity.EntityWatchResponse{
				Timestamp: time.Now().UnixMilli(),
				Entity:    result,
			})
			if err != nil {
				return err
			}
		}
	}
}

func (s *sqlEntityServer) FindReferences(ctx context.Context, r *entity.ReferenceRequest) (*entity.EntityListResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("missing user in context")
	}

	if r.NextPageToken != "" {
		return nil, fmt.Errorf("not yet supported")
	}

	fields := []string{
		"e.guid", "e.guid",
		"e.namespace", "e.group", "e.group_version", "e.resource", "e.name",
		"e.resource_version", "e.folder", "e.slug", "e.errors", // errors are always returned
		"e.size", "e.updated_at", "e.updated_by",
		"e.title", "e.description", "e.meta",
	}

	sql := "SELECT " + strings.Join(fields, ",") +
		" FROM entity_ref AS er JOIN entity AS e ON er.guid = e.guid" +
		" WHERE er.namespace=? AND er.group=? AND er.resource=? AND er.resolved_to=?"

	rows, err := s.sess.Query(ctx, sql, r.Namespace, r.Group, r.Resource, r.Name)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	token := ""
	rsp := &entity.EntityListResponse{}
	for rows.Next() {
		result := &entity.Entity{}

		args := []any{
			&token, &result.Guid,
			&result.Namespace, &result.Group, &result.GroupVersion, &result.Resource, &result.Name,
			&result.ResourceVersion, &result.Folder, &result.Slug, &result.Errors,
			&result.Size, &result.UpdatedAt, &result.UpdatedBy,
			&result.Title, &result.Description, &result.Meta,
		}

		err = rows.Scan(args...)
		if err != nil {
			return rsp, err
		}

		// // found one more than requested
		// if int64(len(rsp.Results)) >= entityQuery.limit {
		// 	// TODO? should this encode start+offset?
		// 	rsp.NextPageToken = token
		// 	break
		// }

		rsp.Results = append(rsp.Results, result)
	}

	return rsp, err
}
