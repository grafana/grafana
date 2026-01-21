package resource

import (
	"bytes"
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io"
	"iter"
	"strings"
	"text/template"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Templates setup.
var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `data/*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Templates.
var (
	sqlKVKeys                        = mustTemplate("sqlkv_keys.sql")
	sqlKVGet                         = mustTemplate("sqlkv_get.sql")
	sqlKVBatchGet                    = mustTemplate("sqlkv_batch_get.sql")
	sqlKVSaveEvent                   = mustTemplate("sqlkv_save_event.sql")
	sqlKVInsertData                  = mustTemplate("sqlkv_insert_datastore.sql")
	sqlKVUpdateData                  = mustTemplate("sqlkv_update_datastore.sql")
	sqlKVInsertLegacyResourceHistory = mustTemplate("sqlkv_insert_legacy_resource_history.sql")
	sqlKVDeleteLegacyResource        = mustTemplate("sqlkv_delete_legacy_resource.sql")
	sqlKVDelete                      = mustTemplate("sqlkv_delete.sql")
	sqlKVBatchDelete                 = mustTemplate("sqlkv_batch_delete.sql")
)

// sqlKVSection can be embedded in structs used when rendering query templates
// for queries that reference a particular section. The section will be validated,
// and the template can directly reference the `TableName`.
type sqlKVSection struct {
	Section string
}

func (req sqlKVSection) Validate() error {
	if req.Section == "" {
		return fmt.Errorf("section is required")
	}

	if req.Section != dataSection && req.Section != eventsSection {
		return fmt.Errorf("invalid section: %s", req.Section)
	}

	return nil
}

func (req sqlKVSection) TableName() string {
	if req.Section == dataSection {
		return "resource_history"
	}

	return "resource_events"
}

// sqlKVSectionKey can be embedded in structs used when rendering query templates
// for queries that reference both a section and a particular key. The `key` is
// validated, and the template can reference the corresponding `KeyPath`.
type sqlKVSectionKey struct {
	sqlKVSection
	Key string
}

func (req sqlKVSectionKey) Validate() error {
	if err := req.sqlKVSection.Validate(); err != nil {
		return err
	}
	if req.Key == "" {
		return fmt.Errorf("key is required")
	}

	return nil
}

func (req sqlKVSectionKey) KeyPath() string {
	return req.Section + "/" + req.Key
}

type sqlKVGetRequest struct {
	sqltemplate.SQLTemplate
	sqlKVSectionKey
	*sqlKVGetResponse
}

type sqlKVGetResponse struct {
	Value []byte
}

func (req sqlKVGetRequest) Validate() error {
	return req.sqlKVSectionKey.Validate()
}

func (req sqlKVGetRequest) Results() ([]byte, error) {
	return req.Value, nil
}

type sqlKVBatchRequest struct {
	sqltemplate.SQLTemplate
	sqlKVSection
	Keys []string
}

func (req sqlKVBatchRequest) Validate() error {
	return req.sqlKVSection.Validate()
}

func (req sqlKVBatchRequest) KeyPaths() []string {
	result := make([]string, 0, len(req.Keys))
	for _, key := range req.Keys {
		result = append(result, req.Section+"/"+key)
	}

	return result
}

type sqlKVSaveRequest struct {
	sqltemplate.SQLTemplate
	sqlKVSectionKey
	Value []byte

	// old fields that can be removed once we prune resource_history
	GUID      string
	Group     string
	Resource  string
	Namespace string
	Name      string
	Action    int64
	Folder    string
}

func (req sqlKVSaveRequest) Validate() error {
	return req.sqlKVSectionKey.Validate()
}

type sqlKVKeysRequest struct {
	sqltemplate.SQLTemplate
	sqlKVSection
	Options ListOptions
}

func (req sqlKVKeysRequest) Validate() error {
	return req.sqlKVSection.Validate()
}

func (req sqlKVKeysRequest) StartKey() string {
	return req.Section + "/" + req.Options.StartKey
}

func (req sqlKVKeysRequest) EndKey() string {
	if req.Options.EndKey == "" {
		req.Options.EndKey = PrefixRangeEnd(req.Section + "/")
	}

	return req.Section + "/" + req.Options.EndKey
}

func (req sqlKVKeysRequest) SortAscending() bool {
	return req.Options.Sort != SortOrderDesc
}

type sqlKVDeleteRequest struct {
	sqltemplate.SQLTemplate
	sqlKVSectionKey
}

func (req sqlKVDeleteRequest) Validate() error {
	return req.sqlKVSectionKey.Validate()
}

var _ KV = &sqlKV{}

type sqlKV struct {
	dbProvider db.DBProvider
	db         db.DB
	dialect    sqltemplate.Dialect
}

func NewSQLKV(dbProvider db.DBProvider) (KV, error) {
	if dbProvider == nil {
		return nil, fmt.Errorf("dbProvider is required")
	}

	ctx := context.Background()
	dbConn, err := dbProvider.Init(ctx)
	if err != nil {
		return nil, fmt.Errorf("error initializing DB: %w", err)
	}

	dialect := sqltemplate.DialectForDriver(dbConn.DriverName())
	if dialect == nil {
		return nil, fmt.Errorf("unsupported database driver: %s", dbConn.DriverName())
	}

	return &sqlKV{
		dbProvider: dbProvider,
		db:         dbConn,
		dialect:    dialect,
	}, nil
}

func (k *sqlKV) Ping(ctx context.Context) error {
	return k.db.PingContext(ctx)
}

func (k *sqlKV) Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error] {
	return func(yield func(string, error) bool) {
		rows, err := dbutil.QueryRows(ctx, k.db, sqlKVKeys, sqlKVKeysRequest{
			SQLTemplate:  sqltemplate.New(k.dialect),
			sqlKVSection: sqlKVSection{section},
			Options:      opt,
		})
		if err != nil {
			yield("", err)
			return
		}
		defer closeRows(rows, yield)

		for rows.Next() {
			var key string
			if err := rows.Scan(&key); err != nil {
				yield("", fmt.Errorf("error reading row: %w", err))
				return
			}

			if !yield(strings.TrimPrefix(key, section+"/"), nil) {
				return
			}
		}

		if err := rows.Err(); err != nil {
			yield("", fmt.Errorf("failed to read rows: %w", err))
		}
	}
}

func (k *sqlKV) Get(ctx context.Context, section string, key string) (io.ReadCloser, error) {
	value, err := dbutil.QueryRow(ctx, k.db, sqlKVGet, sqlKVGetRequest{
		SQLTemplate:      sqltemplate.New(k.dialect),
		sqlKVSectionKey:  sqlKVSectionKey{sqlKVSection{section}, key},
		sqlKVGetResponse: new(sqlKVGetResponse),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get key: %w", err)
	}

	return io.NopCloser(bytes.NewReader(value)), nil
}

func (k *sqlKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[KeyValue, error] {
	return func(yield func(KeyValue, error) bool) {
		if len(keys) == 0 {
			return
		}

		rows, err := dbutil.QueryRows(ctx, k.db, sqlKVBatchGet, sqlKVBatchRequest{
			SQLTemplate:  sqltemplate.New(k.dialect),
			sqlKVSection: sqlKVSection{section},
			Keys:         keys,
		})
		if err != nil {
			yield(KeyValue{}, err)
			return
		}
		defer closeRows(rows, yield)

		for rows.Next() {
			var key string
			var value []byte
			if err := rows.Scan(&key, &value); err != nil {
				yield(KeyValue{}, fmt.Errorf("error reading row: %w", err))
				return
			}

			kv := KeyValue{
				Key:   strings.TrimPrefix(key, section+"/"),
				Value: io.NopCloser(bytes.NewReader(value)),
			}
			if !yield(kv, nil) {
				return
			}
		}

		if err := rows.Err(); err != nil {
			yield(KeyValue{}, fmt.Errorf("failed to read rows: %w", err))
		}
	}
}

func (k *sqlKV) Save(ctx context.Context, section string, key string) (io.WriteCloser, error) {
	sectionKey := sqlKVSectionKey{sqlKVSection{section}, key}
	if err := sectionKey.Validate(); err != nil {
		return nil, err
	}

	return &sqlWriteCloser{
		kv:         k,
		ctx:        ctx,
		sectionKey: sectionKey,
		buf:        &bytes.Buffer{},
		closed:     false,
	}, nil
}

type sqlWriteCloser struct {
	kv         *sqlKV
	ctx        context.Context
	sectionKey sqlKVSectionKey
	buf        *bytes.Buffer
	closed     bool
}

func (w *sqlWriteCloser) Write(value []byte) (int, error) {
	if w.closed {
		return 0, errors.New("write to closed writer")
	}

	return w.buf.Write(value)
}

func (w *sqlWriteCloser) Close() error {
	if w.closed {
		return nil
	}

	w.closed = true
	value := w.buf.Bytes()
	if value == nil {
		// to prevent NOT NULL constraint violations
		value = []byte{}
	}

	// do regular kv save: simple key_path + value insert with conflict check.
	// can only do this on resource_events for now, until we drop the columns in resource_history
	if w.sectionKey.Section == eventsSection {
		_, err := dbutil.Exec(w.ctx, w.kv.db, sqlKVSaveEvent, sqlKVSaveRequest{
			SQLTemplate:     sqltemplate.New(w.kv.dialect),
			sqlKVSectionKey: w.sectionKey,
			Value:           value,
		})

		if err != nil {
			return fmt.Errorf("failed to save: %w", err)
		}

		return nil
	}

	// if storage_backend is running with an RvManager, it will inject a transaction into the context
	// used to keep backwards compatibility between sql-based kvstore and unified/sql/backend
	tx, ok := rvmanager.TxFromCtx(w.ctx)
	if !ok {
		// temporary save for dataStore without rvmanager (non backwards-compatible)
		// we can use the same template as the event one after we:
		// - move PK from GUID to key_path
		// - remove all unnecessary columns (or at least their NOT NULL constraints)
		_, err := w.kv.Get(w.ctx, w.sectionKey.Section, w.sectionKey.Key)
		if errors.Is(err, ErrNotFound) {
			_, err := dbutil.Exec(w.ctx, w.kv.db, sqlKVInsertData, sqlKVSaveRequest{
				SQLTemplate:     sqltemplate.New(w.kv.dialect),
				sqlKVSectionKey: w.sectionKey,
				GUID:            uuid.New().String(),
				Value:           value,
			})

			if err != nil {
				return fmt.Errorf("failed to insert to datastore: %w", err)
			}

			return nil
		}

		if err != nil {
			return fmt.Errorf("failed to get for save: %w", err)
		}

		_, err = dbutil.Exec(w.ctx, w.kv.db, sqlKVUpdateData, sqlKVSaveRequest{
			SQLTemplate:     sqltemplate.New(w.kv.dialect),
			sqlKVSectionKey: w.sectionKey,
			Value:           value,
		})

		if err != nil {
			return fmt.Errorf("failed to update to datastore: %w", err)
		}

		return nil
	}

	// special, temporary backwards-compatible save that includes all the fields in resource_history that are not relevant
	// for the kvstore, as well as the resource table. This is only called if an RvManager was passed to storage_backend, as that
	// component will be responsible for populating the resource_version and key_path columns.
	// For full backwards-compatibility, the `Save` function needs to be called within a callback that updates the resource_history
	// table with `previous_resource_version` and `generation` and updates the `resource` table accordingly. See the
	// storage_backend for the full implementation.
	dataKey, err := ParseKeyWithGUID(w.sectionKey.Key)
	if err != nil {
		return fmt.Errorf("failed to parse key: %w", err)
	}

	var action int64
	switch dataKey.Action {
	case DataActionCreated:
		action = 1
	case DataActionUpdated:
		action = 2
	case DataActionDeleted:
		action = 3
	default:
		return fmt.Errorf("failed to parse key: invalid action")
	}

	_, err = dbutil.Exec(w.ctx, tx, sqlKVInsertLegacyResourceHistory, sqlKVSaveRequest{
		SQLTemplate:     sqltemplate.New(w.kv.dialect),
		sqlKVSectionKey: w.sectionKey, // unused: key_path is set by rvmanager
		Value:           value,
		GUID:            dataKey.GUID,
		Group:           dataKey.Group,
		Resource:        dataKey.Resource,
		Namespace:       dataKey.Namespace,
		Name:            dataKey.Name,
		Action:          action,
		Folder:          dataKey.Folder,
	})

	if err != nil {
		return fmt.Errorf("failed to save to resource_history: %w", err)
	}

	return nil
}

func (k *sqlKV) Delete(ctx context.Context, section string, key string) error {
	res, err := dbutil.Exec(ctx, k.db, sqlKVDelete, sqlKVDeleteRequest{
		SQLTemplate:     sqltemplate.New(k.dialect),
		sqlKVSectionKey: sqlKVSectionKey{sqlKVSection{section}, key},
	})
	if err != nil {
		return fmt.Errorf("failed to delete key: %w", err)
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to validate delete: %w", err)
	}

	if rows == 0 {
		return ErrNotFound
	}

	return nil
}

func (k *sqlKV) BatchDelete(ctx context.Context, section string, keys []string) error {
	if len(keys) == 0 {
		return nil
	}

	if _, err := dbutil.Exec(ctx, k.db, sqlKVBatchDelete, sqlKVBatchRequest{
		SQLTemplate:  sqltemplate.New(k.dialect),
		sqlKVSection: sqlKVSection{section},
		Keys:         keys,
	}); err != nil {
		return fmt.Errorf("failed to batch delete keys: %w", err)
	}

	return nil
}

func (k *sqlKV) Batch(ctx context.Context, section string, ops []BatchOp) error {
	return fmt.Errorf("Batch operation not implemented for sqlKV")
}

func (k *sqlKV) UnixTimestamp(ctx context.Context) (int64, error) {
	return time.Now().Unix(), nil
}

func closeRows[T any](rows db.Rows, yield func(T, error) bool) {
	if err := rows.Close(); err != nil {
		var zero T
		yield(zero, fmt.Errorf("error closing rows: %w", err))
	}
}
