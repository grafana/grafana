package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"go.opentelemetry.io/otel"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	// Pull in sqlite driver.
	"github.com/mattn/go-sqlite3"
	_ "github.com/mattn/go-sqlite3"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/sqlcommon"
	tupleUtils "github.com/openfga/openfga/pkg/tuple"
)

var tracer = otel.Tracer("openfga/pkg/storage/sqlite")

// SQLite provides a SQLite based implementation of [storage.OpenFGADatastore].
type SQLite struct {
	stbl             sq.StatementBuilderType
	cfg              *Config
	db               *sql.DB
	dbInfo           *sqlcommon.DBInfo
	sqlTime          sq.Sqlizer
	logger           logger.Logger
	dbStatsCollector prometheus.Collector
}

// Ensures that SQLite implements the OpenFGADatastore interface.
var _ storage.OpenFGADatastore = (*SQLite)(nil)

// New creates a new [SQLite] storage.
func New(uri string, cfg *Config) (*SQLite, error) {
	// Set journal mode and busy timeout pragmas if not specified.
	query := url.Values{}
	var err error

	if i := strings.Index(uri, "?"); i != -1 {
		query, err = url.ParseQuery(uri[i+1:])
		if err != nil {
			return nil, fmt.Errorf("error parsing dsn: %w", err)
		}

		uri = uri[:i]
	}

	foundJournalMode := false
	foundBusyTimeout := false
	for _, val := range query["_pragma"] {
		if strings.HasPrefix(val, "journal_mode") {
			foundJournalMode = true
		} else if strings.HasPrefix(val, "busy_timeout") {
			foundBusyTimeout = true
		}
	}

	if !foundJournalMode {
		query.Add("_pragma", "journal_mode(WAL)")
	}
	if !foundBusyTimeout {
		query.Add("_pragma", "busy_timeout(500)")
	}

	uri += "?" + query.Encode()

	db, err := sql.Open("sqlite", uri)
	if err != nil {
		return nil, fmt.Errorf("initialize sqlite connection: %w", err)
	}

	return NewWithDB(db, cfg)
}

// NewWithDB creates a new [SQLite] storage using provided [*sql.DB]
func NewWithDB(db *sql.DB, cfg *Config) (*SQLite, error) {
	var collector prometheus.Collector
	if cfg.ExportMetrics {
		collector = collectors.NewDBStatsCollector(db, "openfga")
		if err := prometheus.Register(collector); err != nil {
			return nil, fmt.Errorf("initialize metrics: %w", err)
		}
	}

	sqlTime := sq.Expr("datetime('subsec')")
	stbl := sq.StatementBuilder.RunWith(db)
	dbInfo := sqlcommon.NewDBInfo(db, stbl, sqlTime)

	return &SQLite{
		cfg:              cfg,
		stbl:             stbl,
		db:               db,
		sqlTime:          sqlTime,
		dbInfo:           dbInfo,
		logger:           cfg.Logger,
		dbStatsCollector: collector,
	}, nil
}

// Close see [storage.OpenFGADatastore].Close.
func (m *SQLite) Close() {
	if m.dbStatsCollector != nil {
		prometheus.Unregister(m.dbStatsCollector)
	}
	m.db.Close()
}

// Read see [storage.RelationshipTupleReader].Read.
func (m *SQLite) Read(ctx context.Context, store string, tupleKey *openfgav1.TupleKey) (storage.TupleIterator, error) {
	ctx, span := tracer.Start(ctx, "sqlite.Read")
	defer span.End()

	return m.read(ctx, store, tupleKey, nil)
}

// ReadPage see [storage.RelationshipTupleReader].ReadPage.
func (m *SQLite) ReadPage(
	ctx context.Context,
	store string,
	tupleKey *openfgav1.TupleKey,
	opts storage.PaginationOptions,
) ([]*openfgav1.Tuple, []byte, error) {
	ctx, span := tracer.Start(ctx, "sqlite.ReadPage")
	defer span.End()

	iter, err := m.read(ctx, store, tupleKey, &opts)
	if err != nil {
		return nil, nil, err
	}
	defer iter.Stop()

	return iter.ToArray(opts)
}

func (m *SQLite) read(ctx context.Context, store string, tupleKey *openfgav1.TupleKey, opts *storage.PaginationOptions) (*sqlcommon.SQLTupleIterator, error) {
	ctx, span := tracer.Start(ctx, "sqlite.read")
	defer span.End()

	sb := m.stbl.
		Select(
			"store", "object_type", "object_id", "relation", "_user",
			"condition_name", "condition_context", "ulid", "inserted_at",
		).
		From("tuple").
		Where(sq.Eq{"store": store})
	if opts != nil {
		sb = sb.OrderBy("ulid")
	}
	objectType, objectID := tupleUtils.SplitObject(tupleKey.GetObject())
	if objectType != "" {
		sb = sb.Where(sq.Eq{"object_type": objectType})
	}
	if objectID != "" {
		sb = sb.Where(sq.Eq{"object_id": objectID})
	}
	if tupleKey.GetRelation() != "" {
		sb = sb.Where(sq.Eq{"relation": tupleKey.GetRelation()})
	}
	if tupleKey.GetUser() != "" {
		sb = sb.Where(sq.Eq{"_user": tupleKey.GetUser()})
	}
	if opts != nil && opts.From != "" {
		token, err := sqlcommon.UnmarshallContToken(opts.From)
		if err != nil {
			return nil, err
		}
		sb = sb.Where(sq.GtOrEq{"ulid": token.Ulid})
	}
	if opts != nil && opts.PageSize != 0 {
		sb = sb.Limit(uint64(opts.PageSize + 1)) // + 1 is used to determine whether to return a continuation token.
	}

	rows, err := sb.QueryContext(ctx)
	if err != nil {

		return nil, handleSQLError(err)
	}

	return sqlcommon.NewSQLTupleIterator(rows), nil
}

// Write see [storage.RelationshipTupleWriter].Write.
func (m *SQLite) Write(ctx context.Context, store string, deletes storage.Deletes, writes storage.Writes) error {
	ctx, span := tracer.Start(ctx, "sqlite.Write")
	defer span.End()

	if len(deletes)+len(writes) > m.MaxTuplesPerWrite() {
		return storage.ErrExceededWriteBatchLimit
	}

	return m.busyRetry(func() error {
		now := time.Now().UTC()
		return write(ctx, m.db, m.stbl, m.sqlTime, store, deletes, writes, now)
	})
}

// ReadUserTuple see [storage.RelationshipTupleReader].ReadUserTuple.
func (m *SQLite) ReadUserTuple(ctx context.Context, store string, tupleKey *openfgav1.TupleKey) (*openfgav1.Tuple, error) {
	ctx, span := tracer.Start(ctx, "sqlite.ReadUserTuple")
	defer span.End()

	objectType, objectID := tupleUtils.SplitObject(tupleKey.GetObject())
	userType := tupleUtils.GetUserTypeFromUser(tupleKey.GetUser())

	var conditionName sql.NullString
	var conditionContext []byte
	var record storage.TupleRecord
	err := m.stbl.
		Select(
			"object_type", "object_id", "relation", "_user",
			"condition_name", "condition_context",
		).
		From("tuple").
		Where(sq.Eq{
			"store":       store,
			"object_type": objectType,
			"object_id":   objectID,
			"relation":    tupleKey.GetRelation(),
			"_user":       tupleKey.GetUser(),
			"user_type":   userType,
		}).
		QueryRowContext(ctx).
		Scan(
			&record.ObjectType,
			&record.ObjectID,
			&record.Relation,
			&record.User,
			&conditionName,
			&conditionContext,
		)
	if err != nil {
		return nil, handleSQLError(err)
	}

	if conditionName.String != "" {
		record.ConditionName = conditionName.String

		if conditionContext != nil {
			var conditionContextStruct structpb.Struct
			if err := proto.Unmarshal(conditionContext, &conditionContextStruct); err != nil {
				return nil, err
			}
			record.ConditionContext = &conditionContextStruct
		}
	}

	return record.AsTuple(), nil
}

// ReadUsersetTuples see [storage.RelationshipTupleReader].ReadUsersetTuples.
func (m *SQLite) ReadUsersetTuples(
	ctx context.Context,
	store string,
	filter storage.ReadUsersetTuplesFilter,
) (storage.TupleIterator, error) {
	ctx, span := tracer.Start(ctx, "sqlite.ReadUsersetTuples")
	defer span.End()

	sb := m.stbl.
		Select(
			"store", "object_type", "object_id", "relation", "_user",
			"condition_name", "condition_context", "ulid", "inserted_at",
		).
		From("tuple").
		Where(sq.Eq{"store": store}).
		Where(sq.Eq{"user_type": tupleUtils.UserSet})

	objectType, objectID := tupleUtils.SplitObject(filter.Object)
	if objectType != "" {
		sb = sb.Where(sq.Eq{"object_type": objectType})
	}
	if objectID != "" {
		sb = sb.Where(sq.Eq{"object_id": objectID})
	}
	if filter.Relation != "" {
		sb = sb.Where(sq.Eq{"relation": filter.Relation})
	}
	if len(filter.AllowedUserTypeRestrictions) > 0 {
		orConditions := sq.Or{}
		for _, userset := range filter.AllowedUserTypeRestrictions {
			if _, ok := userset.GetRelationOrWildcard().(*openfgav1.RelationReference_Relation); ok {
				orConditions = append(orConditions, sq.Like{"_user": userset.GetType() + ":%#" + userset.GetRelation()})
			}
			if _, ok := userset.GetRelationOrWildcard().(*openfgav1.RelationReference_Wildcard); ok {
				orConditions = append(orConditions, sq.Eq{"_user": userset.GetType() + ":*"})
			}
		}
		sb = sb.Where(orConditions)
	}
	rows, err := sb.QueryContext(ctx)
	if err != nil {
		return nil, handleSQLError(err)
	}

	return sqlcommon.NewSQLTupleIterator(rows), nil
}

// ReadStartingWithUser see [storage.RelationshipTupleReader].ReadStartingWithUser.
func (m *SQLite) ReadStartingWithUser(
	ctx context.Context,
	store string,
	opts storage.ReadStartingWithUserFilter,
) (storage.TupleIterator, error) {
	ctx, span := tracer.Start(ctx, "sqlite.ReadStartingWithUser")
	defer span.End()

	var targetUsersArg []string
	for _, u := range opts.UserFilter {
		targetUser := u.GetObject()
		if u.GetRelation() != "" {
			targetUser = strings.Join([]string{u.GetObject(), u.GetRelation()}, "#")
		}
		targetUsersArg = append(targetUsersArg, targetUser)
	}

	rows, err := m.stbl.
		Select(
			"store", "object_type", "object_id", "relation", "_user",
			"condition_name", "condition_context", "ulid", "inserted_at",
		).
		From("tuple").
		Where(sq.Eq{
			"store":       store,
			"object_type": opts.ObjectType,
			"relation":    opts.Relation,
			"_user":       targetUsersArg,
		}).QueryContext(ctx)
	if err != nil {
		return nil, handleSQLError(err)
	}

	return sqlcommon.NewSQLTupleIterator(rows), nil
}

// MaxTuplesPerWrite see [storage.RelationshipTupleWriter].MaxTuplesPerWrite.
func (m *SQLite) MaxTuplesPerWrite() int {
	return m.cfg.MaxTuplesPerWriteField
}

// ReadAuthorizationModel see [storage.AuthorizationModelReadBackend].ReadAuthorizationModel.
func (m *SQLite) ReadAuthorizationModel(ctx context.Context, store string, modelID string) (*openfgav1.AuthorizationModel, error) {
	ctx, span := tracer.Start(ctx, "sqlite.ReadAuthorizationModel")
	defer span.End()

	return sqlcommon.ReadAuthorizationModel(ctx, m.dbInfo, store, modelID)
}

// ReadAuthorizationModels see [storage.AuthorizationModelReadBackend].ReadAuthorizationModels.
func (m *SQLite) ReadAuthorizationModels(
	ctx context.Context,
	store string,
	opts storage.PaginationOptions,
) ([]*openfgav1.AuthorizationModel, []byte, error) {
	ctx, span := tracer.Start(ctx, "sqlite.ReadAuthorizationModels")
	defer span.End()

	sb := m.stbl.Select("authorization_model_id").
		Distinct().
		From("authorization_model").
		Where(sq.Eq{"store": store}).
		OrderBy("authorization_model_id desc")

	if opts.From != "" {
		token, err := sqlcommon.UnmarshallContToken(opts.From)
		if err != nil {
			return nil, nil, err
		}
		sb = sb.Where(sq.LtOrEq{"authorization_model_id": token.Ulid})
	}
	if opts.PageSize > 0 {
		sb = sb.Limit(uint64(opts.PageSize + 1)) // + 1 is used to determine whether to return a continuation token.
	}

	rows, err := sb.QueryContext(ctx)
	if err != nil {
		return nil, nil, handleSQLError(err)
	}
	defer rows.Close()

	var modelIDs []string
	var modelID string

	for rows.Next() {
		err = rows.Scan(&modelID)
		if err != nil {
			return nil, nil, handleSQLError(err)
		}

		modelIDs = append(modelIDs, modelID)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, handleSQLError(err)
	}

	var token []byte
	numModelIDs := len(modelIDs)
	if len(modelIDs) > opts.PageSize {
		numModelIDs = opts.PageSize
		token, err = json.Marshal(sqlcommon.NewContToken(modelID, ""))
		if err != nil {
			return nil, nil, err
		}
	}

	// TODO: make this concurrent with a maximum of 5 goroutines. This may be helpful:
	// https://stackoverflow.com/questions/25306073/always-have-x-number-of-goroutines-running-at-any-time
	models := make([]*openfgav1.AuthorizationModel, 0, numModelIDs)
	// We use numModelIDs here to avoid retrieving possibly one extra model.
	for i := 0; i < numModelIDs; i++ {
		model, err := m.ReadAuthorizationModel(ctx, store, modelIDs[i])
		if err != nil {
			return nil, nil, err
		}
		models = append(models, model)
	}

	return models, token, nil
}

// FindLatestAuthorizationModel see [storage.AuthorizationModelReadBackend].FindLatestAuthorizationModel.
func (m *SQLite) FindLatestAuthorizationModel(ctx context.Context, store string) (*openfgav1.AuthorizationModel, error) {
	ctx, span := tracer.Start(ctx, "sqlite.FindLatestAuthorizationModel")
	defer span.End()

	return sqlcommon.FindLatestAuthorizationModel(ctx, m.dbInfo, store)
}

// MaxTypesPerAuthorizationModel see [storage.TypeDefinitionWriteBackend].MaxTypesPerAuthorizationModel.
func (m *SQLite) MaxTypesPerAuthorizationModel() int {
	return m.cfg.MaxTypesPerModelField
}

// WriteAuthorizationModel see [storage.TypeDefinitionWriteBackend].WriteAuthorizationModel.
func (m *SQLite) WriteAuthorizationModel(ctx context.Context, store string, model *openfgav1.AuthorizationModel) error {
	ctx, span := tracer.Start(ctx, "sqlite.WriteAuthorizationModel")
	defer span.End()

	typeDefinitions := model.GetTypeDefinitions()

	if len(typeDefinitions) > m.MaxTypesPerAuthorizationModel() {
		return storage.ExceededMaxTypeDefinitionsLimitError(m.MaxTypesPerAuthorizationModel())
	}

	return m.busyRetry(func() error {
		return sqlcommon.WriteAuthorizationModel(ctx, m.dbInfo, store, model)
	})
}

// CreateStore adds a new store to the SQLite storage.
func (m *SQLite) CreateStore(ctx context.Context, store *openfgav1.Store) (*openfgav1.Store, error) {
	ctx, span := tracer.Start(ctx, "sqlite.CreateStore")
	defer span.End()

	txn, err := m.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return nil, handleSQLError(err)
	}
	defer func() {
		_ = txn.Rollback()
	}()

	_, err = m.stbl.
		Insert("store").
		Columns("id", "name", "created_at", "updated_at").
		Values(store.GetId(), store.GetName(), sq.Expr("datetime('subsec')"), sq.Expr("datetime('subsec')")).
		RunWith(txn).
		ExecContext(ctx)
	if err != nil {
		return nil, handleSQLError(err)
	}

	var createdAt time.Time
	var id, name string
	err = m.stbl.
		Select("id", "name", "created_at").
		From("store").
		Where(sq.Eq{"id": store.GetId()}).
		RunWith(txn).
		QueryRowContext(ctx).
		Scan(&id, &name, &createdAt)
	if err != nil {
		return nil, handleSQLError(err)
	}

	err = txn.Commit()
	if err != nil {
		return nil, handleSQLError(err)
	}

	return &openfgav1.Store{
		Id:        id,
		Name:      name,
		CreatedAt: timestamppb.New(createdAt),
		UpdatedAt: timestamppb.New(createdAt),
	}, nil
}

// GetStore retrieves the details of a specific store from the SQLite using its storeID.
func (m *SQLite) GetStore(ctx context.Context, id string) (*openfgav1.Store, error) {
	ctx, span := tracer.Start(ctx, "sqlite.GetStore")
	defer span.End()

	row := m.stbl.
		Select("id", "name", "created_at", "updated_at").
		From("store").
		Where(sq.Eq{
			"id":         id,
			"deleted_at": nil,
		}).
		QueryRowContext(ctx)

	var storeID, name string
	var createdAt, updatedAt time.Time
	err := row.Scan(&storeID, &name, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, storage.ErrNotFound
		}
		return nil, handleSQLError(err)
	}

	return &openfgav1.Store{
		Id:        storeID,
		Name:      name,
		CreatedAt: timestamppb.New(createdAt),
		UpdatedAt: timestamppb.New(updatedAt),
	}, nil
}

// ListStores provides a paginated list of all stores present in the SQLite storage.
func (m *SQLite) ListStores(ctx context.Context, opts storage.PaginationOptions) ([]*openfgav1.Store, []byte, error) {
	ctx, span := tracer.Start(ctx, "sqlite.ListStores")
	defer span.End()

	sb := m.stbl.
		Select("id", "name", "created_at", "updated_at").
		From("store").
		Where(sq.Eq{"deleted_at": nil}).
		OrderBy("id")

	if opts.From != "" {
		token, err := sqlcommon.UnmarshallContToken(opts.From)
		if err != nil {
			return nil, nil, err
		}
		sb = sb.Where(sq.GtOrEq{"id": token.Ulid})
	}
	if opts.PageSize > 0 {
		sb = sb.Limit(uint64(opts.PageSize + 1)) // + 1 is used to determine whether to return a continuation token.
	}

	rows, err := sb.QueryContext(ctx)
	if err != nil {
		return nil, nil, handleSQLError(err)
	}
	defer rows.Close()

	var stores []*openfgav1.Store
	var id string
	for rows.Next() {
		var name string
		var createdAt, updatedAt time.Time
		err := rows.Scan(&id, &name, &createdAt, &updatedAt)
		if err != nil {
			return nil, nil, handleSQLError(err)
		}

		stores = append(stores, &openfgav1.Store{
			Id:        id,
			Name:      name,
			CreatedAt: timestamppb.New(createdAt),
			UpdatedAt: timestamppb.New(updatedAt),
		})
	}

	if err := rows.Err(); err != nil {
		return nil, nil, handleSQLError(err)
	}

	if len(stores) > opts.PageSize {
		contToken, err := json.Marshal(sqlcommon.NewContToken(id, ""))
		if err != nil {
			return nil, nil, err
		}
		return stores[:opts.PageSize], contToken, nil
	}

	return stores, nil, nil
}

// DeleteStore removes a store from the SQLite storage.
func (m *SQLite) DeleteStore(ctx context.Context, id string) error {
	ctx, span := tracer.Start(ctx, "sqlite.DeleteStore")
	defer span.End()

	_, err := m.stbl.
		Update("store").
		Set("deleted_at", sq.Expr("datetime('subsec')")).
		Where(sq.Eq{"id": id}).
		ExecContext(ctx)
	if err != nil {
		return handleSQLError(err)
	}

	return nil
}

// WriteAssertions see [storage.AssertionsBackend].WriteAssertions.
func (m *SQLite) WriteAssertions(ctx context.Context, store, modelID string, assertions []*openfgav1.Assertion) error {
	ctx, span := tracer.Start(ctx, "sqlite.WriteAssertions")
	defer span.End()

	marshalledAssertions, err := proto.Marshal(&openfgav1.Assertions{Assertions: assertions})
	if err != nil {
		return err
	}

	return m.busyRetry(func() error {
		_, err = m.stbl.
			Insert("assertion").
			Columns("store", "authorization_model_id", "assertions").
			Values(store, modelID, marshalledAssertions).
			Suffix("ON CONFLICT(store,authorization_model_id) DO UPDATE SET assertions = ?", marshalledAssertions).
			ExecContext(ctx)
		if err != nil {
			return handleSQLError(err)
		}

		return nil
	})
}

// ReadAssertions see [storage.AssertionsBackend].ReadAssertions.
func (m *SQLite) ReadAssertions(ctx context.Context, store, modelID string) ([]*openfgav1.Assertion, error) {
	ctx, span := tracer.Start(ctx, "sqlite.ReadAssertions")
	defer span.End()

	var marshalledAssertions []byte
	err := m.stbl.
		Select("assertions").
		From("assertion").
		Where(sq.Eq{
			"store":                  store,
			"authorization_model_id": modelID,
		}).
		QueryRowContext(ctx).
		Scan(&marshalledAssertions)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []*openfgav1.Assertion{}, nil
		}
		return nil, handleSQLError(err)
	}

	var assertions openfgav1.Assertions
	err = proto.Unmarshal(marshalledAssertions, &assertions)
	if err != nil {
		return nil, err
	}

	return assertions.GetAssertions(), nil
}

// ReadChanges see [storage.ChangelogBackend].ReadChanges.
func (m *SQLite) ReadChanges(
	ctx context.Context,
	store, objectTypeFilter string,
	opts storage.PaginationOptions,
	horizonOffset time.Duration,
) ([]*openfgav1.TupleChange, []byte, error) {
	ctx, span := tracer.Start(ctx, "sqlite.ReadChanges")
	defer span.End()

	sb := m.stbl.
		Select(
			"ulid", "object_type", "object_id", "relation", "_user", "operation",
			"condition_name", "condition_context", "inserted_at",
		).
		From("changelog").
		Where(sq.Eq{"store": store}).
		Where(fmt.Sprintf("inserted_at <= datetime('subsec','-%f seconds')", horizonOffset.Seconds())).
		OrderBy("ulid asc")

	if objectTypeFilter != "" {
		sb = sb.Where(sq.Eq{"object_type": objectTypeFilter})
	}
	if opts.From != "" {
		token, err := sqlcommon.UnmarshallContToken(opts.From)
		if err != nil {
			return nil, nil, err
		}
		if token.ObjectType != objectTypeFilter {
			return nil, nil, storage.ErrMismatchObjectType
		}

		sb = sb.Where(sq.Gt{"ulid": token.Ulid}) // > as we always return a continuation token.
	}
	if opts.PageSize > 0 {
		sb = sb.Limit(uint64(opts.PageSize)) // + 1 is NOT used here as we always return a continuation token.
	}

	rows, err := sb.QueryContext(ctx)
	if err != nil {
		return nil, nil, handleSQLError(err)
	}
	defer rows.Close()

	var changes []*openfgav1.TupleChange
	var ulid string
	for rows.Next() {
		var objectType, objectID, relation, user string
		var operation int
		var insertedAt time.Time
		var conditionName sql.NullString
		var conditionContext []byte

		err = rows.Scan(
			&ulid,
			&objectType,
			&objectID,
			&relation,
			&user,
			&operation,
			&conditionName,
			&conditionContext,
			&insertedAt,
		)
		if err != nil {
			return nil, nil, handleSQLError(err)
		}

		var conditionContextStruct structpb.Struct
		if conditionName.String != "" {
			if conditionContext != nil {
				if err := proto.Unmarshal(conditionContext, &conditionContextStruct); err != nil {
					return nil, nil, err
				}
			}
		}

		tk := tupleUtils.NewTupleKeyWithCondition(
			tupleUtils.BuildObject(objectType, objectID),
			relation,
			user,
			conditionName.String,
			&conditionContextStruct,
		)

		changes = append(changes, &openfgav1.TupleChange{
			TupleKey:  tk,
			Operation: openfgav1.TupleOperation(operation),
			Timestamp: timestamppb.New(insertedAt.UTC()),
		})
	}

	if len(changes) == 0 {
		return nil, nil, storage.ErrNotFound
	}

	contToken, err := json.Marshal(sqlcommon.NewContToken(ulid, objectTypeFilter))
	if err != nil {
		return nil, nil, err
	}

	return changes, contToken, nil
}

func (m *SQLite) IsReady(ctx context.Context) (storage.ReadinessStatus, error) {
	if err := m.db.PingContext(ctx); err != nil {
		return storage.ReadinessStatus{}, err
	}
	return storage.ReadinessStatus{
		IsReady: true,
	}, nil
}

// SQLite will return an SQLITE_BUSY error when the database is locked rather than waiting for the lock.
// This function retries the operation up to 5 times before returning the error.
func (m *SQLite) busyRetry(fn func() error) error {
	for retries := 0; ; retries++ {
		err := fn()
		if err == nil || retries == m.cfg.QueryRetries {
			return err
		}

		var sqliteErr *sqlite3.Error
		if errors.As(err, &sqliteErr) && (sqliteErr.Code == sqlite3.ErrLocked || sqliteErr.Code == sqlite3.ErrBusy) {
			time.Sleep(10 * time.Millisecond)
			continue
		}

		return err
	}

}

func handleSQLError(err error, args ...any) error {
	if strings.Contains(err.Error(), "UNIQUE constraint failed:") {
		if len(args) > 0 {
			if tk, ok := args[0].(*openfgav1.TupleKey); ok {
				return storage.InvalidWriteInputError(tk, openfgav1.TupleOperation_TUPLE_OPERATION_WRITE)
			}
		}
		return storage.ErrCollision
	}

	return sqlcommon.HandleSQLError(err, args...)
}
