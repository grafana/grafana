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

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
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
	sqlKVGet    = mustTemplate("sqlkv_get.sql")
	sqlKVDelete = mustTemplate("sqlkv_delete.sql")
	sqlKVKeys   = mustTemplate("sqlkv_keys.sql")
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

type sqlKVDeleteRequest struct {
	sqltemplate.SQLTemplate
	sqlKVSectionKey
}

func (req sqlKVDeleteRequest) Validate() error {
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
		panic("not implemented!")
	}
}

// TODO: this function only exists to support the testing of the sqlkv implementation before
// we have a proper implementation of `Save`.
func (k *sqlKV) TestingSave(ctx context.Context, key string, value []byte) error {
	stmt := fmt.Sprintf(
		`INSERT INTO resource_events (key_path, value) VALUES (%s, %s)`,
		k.dialect.ArgPlaceholder(1), k.dialect.ArgPlaceholder(2),
	)

	_, err := k.db.ExecContext(ctx, stmt, eventsSection+"/"+key, value)
	return err
}

func (k *sqlKV) Save(ctx context.Context, section string, key string) (io.WriteCloser, error) {
	panic("not implemented!")
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
	panic("not implemented!")
}

func (k *sqlKV) UnixTimestamp(ctx context.Context) (int64, error) {
	panic("not implemented!")
}
