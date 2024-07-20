package sqlstash

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const entityTable = "entity"
const entityHistoryTable = "entity_history"

// Package-level errors.
var (
	ErrNotFound                  = errors.New("entity not found")
	ErrOptimisticLockingFailed   = errors.New("optimistic locking failed")
	ErrUserNotFoundInContext     = errors.New("user not found in context")
	ErrNextPageTokenNotSupported = errors.New("nextPageToken not yet supported")
	ErrLimitNotSupported         = errors.New("limit not yet supported")
)

// Make sure we implement correct interfaces
var _ entity.EntityStoreServer = &sqlEntityServer{}

func ProvideSQLEntityServer(db db.EntityDBInterface, tracer tracing.Tracer /*, cfg *setting.Cfg */) (SqlEntityServer, error) {
	ctx, cancel := context.WithCancel(context.Background())

	entityServer := &sqlEntityServer{
		db:     db,
		log:    log.New("sql-entity-server"),
		ctx:    ctx,
		cancel: cancel,
		tracer: tracer,
	}

	if err := prometheus.Register(NewStorageMetrics()); err != nil {
		entityServer.log.Warn("error registering storage server metrics", "error", err)
	}

	return entityServer, nil
}

type SqlEntityServer interface {
	entity.EntityStoreServer

	// FIXME: accpet a context.Context in the lifecycle methods, and Stop should
	// also return an error.

	Init() error
	Stop()
}

type sqlEntityServer struct {
	log         log.Logger
	db          db.EntityDBInterface // needed to keep xorm engine in scope
	sess        *session.SessionDB
	dialect     migrator.Dialect
	broadcaster resource.Broadcaster[*entity.EntityWatchResponse]
	ctx         context.Context // TODO: remove
	cancel      context.CancelFunc
	tracer      trace.Tracer

	once    sync.Once
	initErr error

	sqlDB      db.DB
	sqlDialect sqltemplate.Dialect
}

func (s *sqlEntityServer) Init() error {
	s.once.Do(func() {
		s.initErr = s.init()
	})

	if s.initErr != nil {
		return fmt.Errorf("initialize Entity Server: %w", s.initErr)
	}

	return s.initErr
}

func (s *sqlEntityServer) init() error {
	if s.sess != nil {
		return nil
	}

	if s.db == nil {
		return errors.New("missing db")
	}

	sqlDB, err := s.db.GetDB()
	if err != nil {
		return err
	}
	s.sqlDB = sqlDB

	driverName := sqlDB.DriverName()
	driverName = strings.TrimSuffix(driverName, "WithHooks")
	switch driverName {
	case db.DriverMySQL:
		s.sqlDialect = sqltemplate.MySQL
	case db.DriverPostgres:
		s.sqlDialect = sqltemplate.PostgreSQL
	case db.DriverSQLite, db.DriverSQLite3:
		s.sqlDialect = sqltemplate.SQLite
	default:
		return fmt.Errorf("no dialect for driver %q", driverName)
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

	// set up the broadcaster
	s.broadcaster, err = resource.NewBroadcaster(s.ctx, func(stream chan<- *entity.EntityWatchResponse) error {
		// start the poller
		go s.poller(stream)

		return nil
	})
	if err != nil {
		return err
	}

	return nil
}

func (s *sqlEntityServer) IsHealthy(ctx context.Context, r *entity.HealthCheckRequest) (*entity.HealthCheckResponse, error) {
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "isHealthy"}))
	if err := s.Init(); err != nil {
		ctxLogger.Error("init error", "error", err)
		return nil, err
	}

	if err := s.sqlDB.PingContext(ctx); err != nil {
		return nil, err
	}
	// TODO: check the status of the watcher implementation as well

	return &entity.HealthCheckResponse{Status: entity.HealthCheckResponse_SERVING}, nil
}

func (s *sqlEntityServer) Stop() {
	s.cancel()
}

type FieldSelectRequest interface {
	GetWithBody() bool
	GetWithStatus() bool
}

func (s *sqlEntityServer) getReadFields(r FieldSelectRequest) []string {
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

	if r.GetWithBody() {
		fields = append(fields, `body`)
	}
	if r.GetWithStatus() {
		fields = append(fields, "status")
	}

	return fields
}

func (s *sqlEntityServer) getReadSelect(r FieldSelectRequest) (string, error) {
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

func oldReadEntity(rows *sql.Rows, r FieldSelectRequest) (*entity.Entity, error) {
	raw := &entity.Entity{
		Origin: &entity.EntityOriginInfo{},
	}

	errors := ""
	labels := ""
	fields := ""

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
	if r.GetWithBody() {
		args = append(args, &raw.Body)
	}
	if r.GetWithStatus() {
		args = append(args, &raw.Status)
	}

	err := rows.Scan(args...)
	if err != nil {
		return nil, err
	}

	// unmarshal json labels
	if labels != "" {
		if err := json.Unmarshal([]byte(labels), &raw.Labels); err != nil {
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
	ctx, span := s.tracer.Start(ctx, "storage_server.Read")
	defer span.End()
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "read"}))

	if err := s.Init(); err != nil {
		ctxLogger.Error("init error", "error", err)
		return nil, err
	}

	res, err := s.read(ctx, s.sess, r)
	if err != nil {
		ctxLogger.Error("read error", "error", err)
	}
	return res, err
}

func (s *sqlEntityServer) read(ctx context.Context, tx session.SessionQuerier, r *entity.ReadEntityRequest) (*entity.Entity, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.read")
	defer span.End()

	table := entityTable
	where := []string{}
	args := []any{}

	if r.Key == "" {
		return nil, fmt.Errorf("missing key")
	}

	key, err := grafanaregistry.ParseKey(r.Key)
	if err != nil {
		return nil, err
	}

	where = append(where, s.dialect.Quote("namespace")+"=?", s.dialect.Quote("group")+"=?", s.dialect.Quote("resource")+"=?", s.dialect.Quote("name")+"=?")
	args = append(args, key.Namespace, key.Group, key.Resource, key.Name)

	if r.ResourceVersion != 0 {
		table = entityHistoryTable
		where = append(where, s.dialect.Quote("resource_version")+">=?")
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

	if r.ResourceVersion != 0 {
		query += " ORDER BY resource_version DESC"
	}
	query += " LIMIT 1"

	s.log.Debug("read", "query", query, "args", args)

	rows, err := tx.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return &entity.Entity{}, nil
	}

	return oldReadEntity(rows, r)
}

func (s *sqlEntityServer) History(ctx context.Context, r *entity.EntityHistoryRequest) (*entity.EntityHistoryResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.History")
	defer span.End()
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "history"}))

	if err := s.Init(); err != nil {
		ctxLogger.Error("init error", "error", err)
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		ctxLogger.Error("error getting user from ctx", "error", err)
		return nil, err
	}
	if user == nil {
		ctxLogger.Error("could not find user in context", "error", ErrUserNotFoundInContext)
		return nil, ErrUserNotFoundInContext
	}

	res, err := s.history(ctx, r)
	if err != nil {
		ctxLogger.Error("history error", "error", err)
	}
	return res, err
}

func (s *sqlEntityServer) history(ctx context.Context, r *entity.EntityHistoryRequest) (*entity.EntityHistoryResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.history")
	defer span.End()

	var limit int64 = 100
	if r.Limit > 0 && r.Limit < 100 {
		limit = r.Limit
	}

	entityQuery := selectQuery{
		dialect:  s.dialect,
		from:     entityHistoryTable, // the table
		limit:    r.Limit,
		oneExtra: true, // request one more than the limit (and show next token if it exists)
	}

	fields := s.getReadFields(r)
	entityQuery.AddFields(fields...)

	if r.Key != "" {
		key, err := grafanaregistry.ParseKey(r.Key)
		if err != nil {
			return nil, err
		}

		if key.Name == "" {
			return nil, fmt.Errorf("missing name")
		}

		args := []any{key.Group, key.Resource}
		whereclause := "(" + s.dialect.Quote("group") + "=? AND " + s.dialect.Quote("resource") + "=?"
		if key.Namespace != "" {
			args = append(args, key.Namespace)
			whereclause += " AND " + s.dialect.Quote("namespace") + "=?"
		}
		args = append(args, key.Name)
		whereclause += " AND " + s.dialect.Quote("name") + "=?)"

		entityQuery.AddWhere(whereclause, args...)
	} else if r.Guid != "" {
		entityQuery.AddWhere(s.dialect.Quote("guid")+"=?", r.Guid)
	} else {
		return nil, fmt.Errorf("no key or guid specified")
	}

	if r.Before > 0 {
		entityQuery.AddWhere(s.dialect.Quote("resource_version")+"<?", r.Before)
	}

	// if we have a page token, use that to specify the first record
	continueToken, err := GetContinueToken(r)
	if err != nil {
		return nil, err
	}
	if continueToken != nil {
		entityQuery.offset = continueToken.StartOffset
	}

	for _, sort := range r.Sort {
		sortBy, err := ParseSortBy(sort)
		if err != nil {
			return nil, err
		}
		entityQuery.AddOrderBy(sortBy.Field, sortBy.Direction)
	}
	entityQuery.AddOrderBy("resource_version", Ascending)

	query, args := entityQuery.ToQuery()

	s.log.Debug("history", "query", query, "args", args)

	rows, err := s.query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	rsp := &entity.EntityHistoryResponse{
		Key: r.Key,
	}
	for rows.Next() {
		v, err := oldReadEntity(rows, r)
		if err != nil {
			return nil, err
		}

		if rsp.ResourceVersion == 0 {
			rsp.ResourceVersion, err = s.getLatestVersion(ctx, v.Group, v.Resource)
			if err != nil {
				return nil, fmt.Errorf("get latest version for group %q and"+
					" resource %q: %w", v.Group, v.Resource, err)
			}
		}

		// found more than requested
		if int64(len(rsp.Versions)) >= limit {
			continueToken := &ContinueToken{
				Sort:            r.Sort,
				StartOffset:     entityQuery.offset + entityQuery.limit,
				ResourceVersion: rsp.ResourceVersion,
			}
			rsp.NextPageToken = continueToken.String()
			break
		}

		rsp.Versions = append(rsp.Versions, v)
	}

	return rsp, err
}

type ContinueRequest interface {
	GetNextPageToken() string
	GetSort() []string
}

type ContinueToken struct {
	Sort            []string `json:"s"`
	StartOffset     int64    `json:"o"`
	ResourceVersion int64    `json:"v"`
	RecordCnt       int64    `json:"c"`
}

func (c *ContinueToken) String() string {
	b, _ := json.Marshal(c)
	return base64.StdEncoding.EncodeToString(b)
}

func GetContinueToken(r ContinueRequest) (*ContinueToken, error) {
	if r.GetNextPageToken() == "" {
		return nil, nil
	}

	continueVal, err := base64.StdEncoding.DecodeString(r.GetNextPageToken())
	if err != nil {
		return nil, fmt.Errorf("error decoding continue token")
	}

	t := &ContinueToken{}
	err = json.Unmarshal(continueVal, t)
	if err != nil {
		return nil, err
	}

	if !slices.Equal(t.Sort, r.GetSort()) {
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

func ParseSortBy(sort string) (SortBy, error) {
	sortBy := SortBy{
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
		return sortBy, fmt.Errorf("invalid sort field %q, valid fields: %v", sortBy.Field, sortByFields)
	}

	return sortBy, nil
}

//nolint:gocyclo
func (s *sqlEntityServer) List(ctx context.Context, r *entity.EntityListRequest) (*entity.EntityListResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.List")
	defer span.End()
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "list"}))

	if err := s.Init(); err != nil {
		ctxLogger.Error("init error", "error", err)
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		ctxLogger.Error("error getting user from ctx", "error", err)
		return nil, err
	}
	if user == nil {
		ctxLogger.Error("could not find user in context", "error", ErrUserNotFoundInContext)
		return nil, ErrUserNotFoundInContext
	}

	fields := s.getReadFields(r)

	// main query we will use to retrieve entities
	entityQuery := NewSelectQuery(s.dialect, entityTable)
	entityQuery.AddFields(fields...)
	entityQuery.SetLimit(r.Limit)
	entityQuery.SetOneExtra()

	// query to retrieve the max resource version and entity count
	rvMaxQuery := NewSelectQuery(s.dialect, entityTable)
	rvMaxQuery.AddRawFields("coalesce(max(resource_version),0) as rv", "count(guid) as cnt")

	// subquery to get latest resource version for each entity
	// when we need to query from entity_history
	rvSubQuery := NewSelectQuery(s.dialect, entityHistoryTable)
	rvSubQuery.AddFields("guid")
	rvSubQuery.AddRawFields("max(resource_version) as max_rv")

	// if we are looking for deleted entities, we list "deleted" entries from the entity_history table
	if r.Deleted {
		entityQuery.from = entityHistoryTable
		entityQuery.AddWhere("action", entity.Entity_DELETED)

		rvMaxQuery.from = entityHistoryTable
		rvMaxQuery.AddWhere("action", entity.Entity_DELETED)
	}

	// TODO fix this
	// entityQuery.addWhere("namespace", user.OrgID)

	if len(r.Group) > 0 {
		entityQuery.AddWhereIn("group", ToAnyList(r.Group))
		rvMaxQuery.AddWhereIn("group", ToAnyList(r.Group))
		rvSubQuery.AddWhereIn("group", ToAnyList(r.Group))
	}

	if len(r.Resource) > 0 {
		entityQuery.AddWhereIn("resource", ToAnyList(r.Resource))
		rvMaxQuery.AddWhereIn("resource", ToAnyList(r.Resource))
		rvSubQuery.AddWhereIn("resource", ToAnyList(r.Resource))
	}

	if len(r.Key) > 0 {
		where := []string{}
		args := []any{}
		for _, k := range r.Key {
			key, err := grafanaregistry.ParseKey(k)
			if err != nil {
				return nil, err
			}

			args = append(args, key.Group, key.Resource)
			whereclause := "(t." + s.dialect.Quote("group") + "=? AND t." + s.dialect.Quote("resource") + "=?"
			if key.Namespace != "" {
				args = append(args, key.Namespace)
				whereclause += " AND t." + s.dialect.Quote("namespace") + "=?"
			}
			if key.Name != "" {
				args = append(args, key.Name)
				whereclause += " AND t." + s.dialect.Quote("name") + "=?"
			}
			whereclause += ")"

			where = append(where, whereclause)
		}

		entityQuery.AddWhere("("+strings.Join(where, " OR ")+")", args...)
		rvMaxQuery.AddWhere("("+strings.Join(where, " OR ")+")", args...)
		rvSubQuery.AddWhere("("+strings.Join(where, " OR ")+")", args...)
	}

	// nolint:staticcheck
	if len(r.OriginKeys) > 0 {
		entityQuery.AddWhereIn("origin_key", ToAnyList(r.OriginKeys))
		rvMaxQuery.AddWhereIn("origin_key", ToAnyList(r.OriginKeys))
		rvSubQuery.AddWhereIn("origin_key", ToAnyList(r.OriginKeys))
	}

	// get the maximum resource version and count of entities
	type RVMaxRow struct {
		Rv  int64 `db:"rv"`
		Cnt int64 `db:"cnt"`
	}
	rvMaxRow := &RVMaxRow{}
	query, args := rvMaxQuery.ToQuery()

	err = s.sess.Get(ctx, rvMaxRow, query, args...)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			ctxLogger.Error("error running rvMaxQuery", "error", err)
			return nil, err
		}
	}

	ctxLogger.Debug("getting max rv", "maxRv", rvMaxRow.Rv, "cnt", rvMaxRow.Cnt, "query", query, "args", args)

	// if we have a page token, use that to specify the first record
	continueToken, err := GetContinueToken(r)
	if err != nil {
		ctxLogger.Error("error getting continue token", "error", err)
		return nil, err
	}
	if continueToken != nil {
		entityQuery.offset = continueToken.StartOffset
		if continueToken.ResourceVersion > 0 {
			if r.Deleted {
				// if we're continuing, we need to list only revisions that are older than the given resource version
				entityQuery.AddWhere("resource_version <= ?", continueToken.ResourceVersion)
			} else {
				// cap versions considered by the per resource max version subquery
				rvSubQuery.AddWhere("resource_version <= ?", continueToken.ResourceVersion)
			}
		}

		if (continueToken.ResourceVersion > 0 && continueToken.ResourceVersion != rvMaxRow.Rv) || (continueToken.RecordCnt > 0 && continueToken.RecordCnt != rvMaxRow.Cnt) {
			entityQuery.From(entityHistoryTable)
			entityQuery.AddWhere("t.action != ?", entity.Entity_DELETED)

			rvSubQuery.AddGroupBy("guid")
			query, args = rvSubQuery.ToQuery()
			entityQuery.AddJoin("INNER JOIN ("+query+") rv ON rv.guid = t.guid AND rv.max_rv = t.resource_version", args...)
		}
	} else {
		continueToken = &ContinueToken{
			Sort:            r.Sort,
			StartOffset:     0,
			ResourceVersion: rvMaxRow.Rv,
			RecordCnt:       rvMaxRow.Cnt,
		}
	}

	// initialize the result
	rsp := new(entity.EntityListResponse)

	// Folder guid
	if r.Folder != "" {
		entityQuery.AddWhere("folder", r.Folder)
	}

	if len(r.Labels) > 0 {
		// if we are looking for deleted entities, we need to use the labels column
		if entityQuery.from == entityHistoryTable {
			for labelKey, labelValue := range r.Labels {
				entityQuery.AddWhereJsonContainsKV("labels", labelKey, labelValue)
			}
			// for active entities, we can use the entity_labels table
		} else {
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

			entityQuery.AddWhereInSubquery("guid", query, args)
		}
	}

	for _, sort := range r.Sort {
		sortBy, err := ParseSortBy(sort)
		if err != nil {
			return nil, err
		}
		entityQuery.AddOrderBy(sortBy.Field, sortBy.Direction)
	}
	entityQuery.AddOrderBy("guid", Ascending)

	query, args = entityQuery.ToQuery()

	ctxLogger.Debug("listing", "query", query, "args", args)

	rows, err := s.query(ctx, query, args...)
	if err != nil {
		ctxLogger.Error("error running list query", "error", err)
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		result, err := oldReadEntity(rows, r)
		if err != nil {
			ctxLogger.Error("error reading rows to entity", "error", err)
			return rsp, err
		}

		if continueToken.ResourceVersion == 0 {
			continueToken.ResourceVersion, err = s.getLatestVersion(ctx, result.Group, result.Resource)
			if err != nil {
				return nil, fmt.Errorf("get latest version for group %q and"+
					" resource %q: %w", result.Group, result.Resource, err)
			}
			rsp.ResourceVersion = continueToken.ResourceVersion
		}

		// found more than requested
		if entityQuery.limit > 0 && int64(len(rsp.Results)) >= entityQuery.limit {
			continueToken.StartOffset = entityQuery.offset + entityQuery.limit
			rsp.NextPageToken = continueToken.String()
			break
		}

		rsp.Results = append(rsp.Results, result)
	}
	span.AddEvent("processed rows", trace.WithAttributes(attribute.Int("row_count", len(rsp.Results))))

	return rsp, err
}

func (s *sqlEntityServer) Watch(w entity.EntityStore_WatchServer) error {
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(w.Context(), []any{"method", "watch"}))

	if err := s.Init(); err != nil {
		ctxLogger.Error("init error", "error", err)
		return err
	}

	user, err := identity.GetRequester(w.Context())
	if err != nil {
		ctxLogger.Error("error getting user from ctx", "error", err)
		return err
	}
	if user == nil {
		ctxLogger.Error("could not find user in context", "error", ErrUserNotFoundInContext)
		return ErrUserNotFoundInContext
	}

	r, err := w.Recv()
	if err != nil {
		ctxLogger.Error("recv error", "error", err)
		return err
	}

	// collect and send any historical events
	if r.SendInitialEvents {
		r.Since, err = s.watchInit(w.Context(), r, w)
		if err != nil {
			ctxLogger.Error("watch init error", "err", err)
			return err
		}
	}

	// subscribe to new events
	err = s.watch(r, w)
	if err != nil {
		ctxLogger.Error("watch error", "err", err)
		return err
	}

	return nil
}

// watchInit is a helper function to send the initial set of entities to the client
func (s *sqlEntityServer) watchInit(ctx context.Context, r *entity.EntityWatchRequest, w entity.EntityStore_WatchServer) (int64, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.watchInit")
	defer span.End()
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "watchInit"}))

	lastRv := r.Since

	fields := s.getReadFields(r)

	entityQuery := selectQuery{
		dialect:  s.dialect,
		from:     entityTable, // the table
		limit:    1000,        // r.Limit,
		oneExtra: true,        // request one more than the limit (and show next token if it exists)
	}

	entityQuery.AddFields(fields...)

	// TODO fix this
	// entityQuery.addWhere("namespace", user.OrgID)

	if len(r.Resource) > 0 {
		entityQuery.AddWhereIn("resource", ToAnyList(r.Resource))
	}

	if len(r.Key) > 0 {
		where := []string{}
		args := []any{}
		for _, k := range r.Key {
			key, err := grafanaregistry.ParseKey(k)
			if err != nil {
				ctxLogger.Error("error parsing key", "error", err, "key", k)
				return lastRv, err
			}

			args = append(args, key.Group, key.Resource)
			whereclause := "(" + s.dialect.Quote("group") + "=? AND " + s.dialect.Quote("resource") + "=?"
			if key.Namespace != "" {
				args = append(args, key.Namespace)
				whereclause += " AND " + s.dialect.Quote("namespace") + "=?"
			}
			if key.Name != "" {
				args = append(args, key.Name)
				whereclause += " AND " + s.dialect.Quote("name") + "=?"
			}
			whereclause += ")"

			where = append(where, whereclause)
		}

		entityQuery.AddWhere("("+strings.Join(where, " OR ")+")", args...)
	}

	// Folder guid
	if r.Folder != "" {
		entityQuery.AddWhere("folder", r.Folder)
	}

	if len(r.Labels) > 0 {
		if entityQuery.from != entityTable {
			for labelKey, labelValue := range r.Labels {
				entityQuery.AddWhereJsonContainsKV("labels", labelKey, labelValue)
			}
		} else {
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

			entityQuery.AddWhereInSubquery("guid", query, args)
		}
	}

	entityQuery.AddOrderBy("resource_version", Ascending)

	var err error

	for hasmore := true; hasmore; {
		err = func() error {
			query, args := entityQuery.ToQuery()

			ctxLogger.Debug("watch init", "query", query, "args", args)

			rows, err := s.query(ctx, query, args...)
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

				result, err := oldReadEntity(rows, r)
				if err != nil {
					return err
				}

				if result.ResourceVersion > lastRv {
					lastRv = result.ResourceVersion
				}

				resp := &entity.EntityWatchResponse{
					Timestamp: time.Now().UnixMilli(),
					Entity:    result,
				}

				ctxLogger.Debug("sending init event", "guid", result.Guid, "action", result.Action, "rv", result.ResourceVersion)

				err = w.Send(resp)
				if err != nil {
					return err
				}
			}

			hasmore = false
			return nil
		}()
		if err != nil {
			ctxLogger.Error("watchInit error", "error", err)
			return lastRv, err
		}
	}

	// send a bookmark event
	if r.AllowWatchBookmarks {
		resp := &entity.EntityWatchResponse{
			Timestamp: time.Now().UnixMilli(),
			Entity: &entity.Entity{
				Action:          entity.Entity_BOOKMARK,
				ResourceVersion: lastRv,
			},
		}
		err = w.Send(resp)
		if err != nil {
			ctxLogger.Error("error sending bookmark event", "error", err)
			return lastRv, err
		}
	}

	return lastRv, nil
}

func (s *sqlEntityServer) poller(stream chan<- *entity.EntityWatchResponse) {
	var err error

	// FIXME: we need a way to state startup of server from a (Group, Resource)
	// standpoint, and consider that new (Group, Resource) may be added to
	// `kind_version`, so we should probably also poll for changes in there
	since := int64(0)

	interval := 1 * time.Second

	t := time.NewTicker(interval)
	defer close(stream)
	defer t.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-t.C:
			since, err = s.poll(since, stream)
			if err != nil {
				s.log.Error("watch error", "err", err)
			}
			t.Reset(interval)
		}
	}
}

func (s *sqlEntityServer) poll(since int64, out chan<- *entity.EntityWatchResponse) (int64, error) {
	ctx, span := s.tracer.Start(s.ctx, "storage_server.poll")
	defer span.End()
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "poll"}))

	rr := &entity.ReadEntityRequest{
		WithBody:   true,
		WithStatus: true,
	}

	fields := s.getReadFields(rr)

	for hasmore := true; hasmore; {
		err := func() error {
			entityQuery := selectQuery{
				dialect: s.dialect,
				from:    entityHistoryTable, // the table
				limit:   100,                // r.Limit,
				// offset:   0,
				oneExtra: true, // request one more than the limit (and show next token if it exists)
				orderBy:  []string{"resource_version"},
			}

			entityQuery.AddFields(fields...)
			entityQuery.AddWhere("resource_version > ?", since)

			query, args := entityQuery.ToQuery()
			query += ";"

			rows, err := s.query(ctx, query, args...)
			if err != nil {
				return err
			}
			defer func() { _ = rows.Close() }()

			found := int64(0)
			for rows.Next() {
				// check if the context is done
				if ctx.Err() != nil {
					hasmore = false
					return nil
				}

				found++
				if found > entityQuery.limit {
					return nil
				}

				updated, err := oldReadEntity(rows, rr)
				if err != nil {
					ctxLogger.Error("poll error readEntity", "error", err)
					return err
				}

				if updated.ResourceVersion > since {
					since = updated.ResourceVersion
				}

				result := &entity.EntityWatchResponse{
					Timestamp: time.Now().UnixMilli(),
					Entity:    updated,
				}

				if updated.Action == entity.Entity_UPDATED || updated.Action == entity.Entity_DELETED {
					rr := &entity.EntityHistoryRequest{
						Guid:       updated.Guid,
						Before:     updated.ResourceVersion,
						Limit:      1,
						Sort:       []string{"resource_version_desc"},
						WithBody:   rr.WithBody,
						WithStatus: rr.WithStatus,
					}
					history, err := s.history(ctx, rr)
					if err != nil {
						ctxLogger.Error("error reading previous entity", "guid", updated.Guid, "err", err)
						return err
					}

					if len(history.Versions) == 0 {
						ctxLogger.Error("error reading previous entity", "guid", updated.Guid, "err", "no previous version found")
						return errors.New("no previous version found")
					}

					result.Previous = history.Versions[0]
				}

				ctxLogger.Debug("sending poll result", "guid", updated.Guid, "action", updated.Action, "rv", updated.ResourceVersion)
				out <- result
			}

			hasmore = false
			return nil
		}()
		if err != nil {
			ctxLogger.Error("poll error", "error", err)
			return since, err
		}
	}

	return since, nil
}

func watchMatches(r *entity.EntityWatchRequest, result *entity.Entity) bool {
	if result == nil {
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
	if len(r.Key) > 0 {
		matched := false
		for _, k := range r.Key {
			key, err := grafanaregistry.ParseKey(k)
			if err != nil {
				return false
			}

			if key.Group == result.Group && key.Resource == result.Resource && (key.Namespace == "" || key.Namespace == result.Namespace) && (key.Name == "" || key.Name == result.Name) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// must match all specified label/value pairs
	if len(r.Labels) > 0 {
		for labelKey, labelValue := range r.Labels {
			if result.Labels[labelKey] != labelValue {
				return false
			}
		}
	}

	return true
}

// watch is a helper to get the next set of entities and send them to the client
func (s *sqlEntityServer) watch(r *entity.EntityWatchRequest, w entity.EntityStore_WatchServer) error {
	s.log.Debug("watch started", "since", r.Since)

	evts, err := s.broadcaster.Subscribe(w.Context())
	if err != nil {
		return err
	}
	defer s.broadcaster.Unsubscribe(evts)

	stop := make(chan struct{})
	since := r.Since

	go func() {
		defer close(stop)
		for {
			r, err := w.Recv()
			if errors.Is(err, io.EOF) {
				s.log.Debug("watch client closed stream")
				return
			}
			if err != nil {
				s.log.Error("error receiving message", "err", err)
				return
			}
			if r.Action == entity.EntityWatchRequest_STOP {
				s.log.Debug("watch stop requested")
				return
			}
			// handle any other message types
			s.log.Debug("watch received unexpected message", "action", r.Action)
		}
	}()

	for {
		select {
		case <-stop:
			s.log.Debug("watch stopped")
			return nil
		// context canceled
		case <-w.Context().Done():
			s.log.Debug("watch context done")
			return nil
		// got a raw result from the broadcaster
		case result, ok := <-evts:
			if !ok {
				s.log.Debug("watch events closed")
				return nil
			}

			// Invalid result or resource version too old
			if result == nil || result.Entity == nil || result.Entity.ResourceVersion <= since {
				break
			}

			since = result.Entity.ResourceVersion

			resp, err := s.watchEvent(r, result)
			if err != nil {
				break
			}
			if resp == nil {
				break
			}

			err = w.Send(resp)
			if err != nil {
				s.log.Error("error sending watch event", "err", err)
				return err
			}
		}
	}
}

func (s *sqlEntityServer) watchEvent(r *entity.EntityWatchRequest, result *entity.EntityWatchResponse) (*entity.EntityWatchResponse, error) {
	// if neither the previous nor the current result match our watch params, skip it
	if !watchMatches(r, result.Entity) && !watchMatches(r, result.Previous) {
		s.log.Debug("watch result not matched", "guid", result.Entity.Guid, "action", result.Entity.Action, "rv", result.Entity.ResourceVersion)
		return nil, nil
	}

	// remove the body and status if not requested
	if !r.WithBody {
		result.Entity.Body = nil
		if result.Previous != nil {
			result.Previous.Body = nil
		}
	}
	if !r.WithStatus {
		result.Entity.Status = nil
		if result.Previous != nil {
			result.Previous.Status = nil
		}
	}

	s.log.Debug("sending watch result", "guid", result.Entity.Guid, "action", result.Entity.Action, "rv", result.Entity.ResourceVersion)
	return result, nil
}

func (s *sqlEntityServer) FindReferences(ctx context.Context, r *entity.ReferenceRequest) (*entity.EntityListResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.FindReferences")
	defer span.End()
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "findReferences"}))

	if err := s.Init(); err != nil {
		ctxLogger.Error("init error", "error", err)
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		ctxLogger.Error("error getting user from ctx", "error", err)
		return nil, err
	}
	if user == nil {
		ctxLogger.Error("could not find user in context", "error", ErrUserNotFoundInContext)
		return nil, ErrUserNotFoundInContext
	}

	if r.NextPageToken != "" {
		ctxLogger.Error("nextPageToken not yet supported", "error", ErrNextPageTokenNotSupported)
		return nil, ErrNextPageTokenNotSupported
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

	rows, err := s.query(ctx, sql, r.Namespace, r.Group, r.Resource, r.Name)
	if err != nil {
		ctxLogger.Error("query error", "error", err)
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
			ctxLogger.Error("error scanning rows", "error", err)
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

func (s *sqlEntityServer) query(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.query", trace.WithAttributes(attribute.String("query", query)))
	defer span.End()

	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// getLatestVersion returns the latest committed resource version for a given
// kind.
//
// NOTE: This is a temporary workaround to allow old read operations to use the
// new resource versioning scheme, which uses `kind_version` table. Note that
// this is executed in a different transaction. This will be changed in future
// PRs.
func (s *sqlEntityServer) getLatestVersion(ctx context.Context, group, resource string) (int64, error) {
	var ret int64

	err := s.sqlDB.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		req := sqlKindVersionGetRequest{
			SQLTemplate:        sqltemplate.New(s.sqlDialect),
			Group:              group,
			Resource:           resource,
			returnsKindVersion: new(returnsKindVersion),
		}
		res, err := queryRow(ctx, tx, sqlKindVersionGet, req)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if res != nil {
			ret = res.ResourceVersion
		}

		return nil
	})

	return ret, err
}
