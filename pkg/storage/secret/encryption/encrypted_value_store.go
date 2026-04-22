package encryption

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	sq "github.com/Masterminds/squirrel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
)

var (
	ErrEncryptedValueNotFound         = errors.New("encrypted value not found")
	ErrEncryptedValueAlreadyExists    = errors.New("encrypted value alredy exists")
	ErrUnexpectedNumberOfRowsAffected = errors.New("unexpected number of rows modified by query")
)

const tableEncryptedValue = "secret_encrypted_value"

var encryptedValueColumns = []string{
	"namespace", "name", "version", "encrypted_data", "data_key_id", "created", "updated",
}

// allowedListAllOrderBy is the set of columns ListAll callers are permitted to
// sort by. Anything outside this set is rejected to prevent the column name
// from being interpolated unescaped into the ORDER BY clause.
var allowedListAllOrderBy = map[string]struct{}{
	"created":   {},
	"namespace": {},
}

func ProvideEncryptedValueStorage(
	db contracts.Database,
	tracer trace.Tracer,
) (contracts.EncryptedValueStorage, error) {
	builder, ph := database.NewBuilder(db.DriverName())
	return &encryptedValStorage{
		db:      db,
		builder: builder,
		ph:      ph,
		tracer:  tracer,
	}, nil
}

type encryptedValStorage struct {
	db      contracts.Database
	builder sq.StatementBuilderType
	ph      sq.PlaceholderFormat
	tracer  trace.Tracer
}

func (s *encryptedValStorage) Create(ctx context.Context, namespace xkube.Namespace, name string, version int64, encryptedData contracts.EncryptedPayload) (ev *contracts.EncryptedValue, err error) {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Create", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	defer func() {
		if ev != nil {
			span.SetAttributes(
				attribute.String("namespace", ev.Namespace),
				attribute.String("name", ev.Name),
				attribute.Int64("version", ev.Version),
			)
		}
	}()

	createdTime := time.Now().Unix()

	encryptedValue := &EncryptedValue{
		Namespace:     namespace.String(),
		Name:          name,
		Version:       version,
		EncryptedData: encryptedData.EncryptedData,
		DataKeyID:     encryptedData.DataKeyID,
		Created:       createdTime,
		Updated:       createdTime,
	}

	query, args, err := s.builder.
		Insert(tableEncryptedValue).
		Columns(encryptedValueColumns...).
		Values(
			encryptedValue.Namespace,
			encryptedValue.Name,
			encryptedValue.Version,
			encryptedValue.EncryptedData,
			encryptedValue.DataKeyID,
			encryptedValue.Created,
			encryptedValue.Updated,
		).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("building insert: %w", err)
	}

	res, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		if sql.IsRowAlreadyExistsError(err) {
			return nil, ErrEncryptedValueAlreadyExists
		}
		return nil, fmt.Errorf("inserting row: %w", err)
	}

	if rowsAffected, err := res.RowsAffected(); err != nil {
		return nil, fmt.Errorf("getting rows affected: %w", err)
	} else if rowsAffected != 1 {
		return nil, fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}

	return &contracts.EncryptedValue{
		Namespace: encryptedValue.Namespace,
		Name:      encryptedValue.Name,
		Version:   encryptedValue.Version,
		EncryptedPayload: contracts.EncryptedPayload{
			DataKeyID:     encryptedValue.DataKeyID,
			EncryptedData: encryptedValue.EncryptedData,
		},
		Created: encryptedValue.Created,
		Updated: encryptedValue.Updated,
	}, nil
}

func (s *encryptedValStorage) Update(ctx context.Context, namespace xkube.Namespace, name string, version int64, encryptedData contracts.EncryptedPayload) error {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Update", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	query, args, err := s.builder.
		Update(tableEncryptedValue).
		Set("encrypted_data", encryptedData.EncryptedData).
		Set("data_key_id", encryptedData.DataKeyID).
		Set("updated", time.Now().Unix()).
		Where(sq.Eq{
			"namespace": namespace.String(),
			"name":      name,
			"version":   version,
		}).
		ToSql()
	if err != nil {
		return fmt.Errorf("building update: %w", err)
	}

	res, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("updating row: %w", err)
	}

	if rowsAffected, err := res.RowsAffected(); err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	} else if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d on %s: %w", rowsAffected, namespace, ErrUnexpectedNumberOfRowsAffected)
	}

	return nil
}

const defaultUpdateBulkChunkSize = 100

func (s *encryptedValStorage) UpdateBulk(ctx context.Context, namespace xkube.Namespace, updates []contracts.BulkUpdateRow, chunkSize int) error {
	if len(updates) == 0 {
		return nil
	}
	if chunkSize <= 0 {
		chunkSize = defaultUpdateBulkChunkSize
	}
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.UpdateBulk", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.Int("updates", len(updates)),
		attribute.Int("chunk_size", chunkSize),
	))
	defer span.End()

	now := time.Now().Unix()
	nsStr := namespace.String()

	for start := 0; start < len(updates); start += chunkSize {
		end := min(start+chunkSize, len(updates))
		chunk := updates[start:end]

		query, args, err := buildBulkUpdateSQL(s.ph, nsStr, chunk, now)
		if err != nil {
			return fmt.Errorf("building bulk update: %w", err)
		}

		res, err := s.db.ExecContext(ctx, query, args...)
		if err != nil {
			return fmt.Errorf("updating bulk chunk at %d: %w", start, err)
		}
		affected, err := res.RowsAffected()
		if err != nil {
			return fmt.Errorf("getting rows affected: %w", err)
		}
		if affected != int64(len(chunk)) {
			return fmt.Errorf("expected %d rows affected, got %d: %w", len(chunk), affected, ErrUnexpectedNumberOfRowsAffected)
		}
	}
	return nil
}

// buildBulkUpdateSQL assembles a single UPDATE ... CASE WHEN ... statement for a
// namespace-scoped chunk of rows. Squirrel's Update().Set() is single-value, so
// the multi-row CASE is built by hand. The output uses `?` placeholders, then
// is rewritten to the driver's placeholder format.
//
// Capacity math: 4 args per row per CASE block (namespace, name, version, value)
// × 2 CASE blocks + 2 args per row for the OR branches + 1 standalone `updated`
// + 1 standalone `namespace` in the WHERE.
func buildBulkUpdateSQL(ph sq.PlaceholderFormat, namespace string, rows []contracts.BulkUpdateRow, updated int64) (string, []any, error) {
	var sb strings.Builder
	// Rough SQL-length estimate: ~100 bytes of fixed scaffolding per CASE block
	// and per-row clause, times the row count. Undersizing costs reallocations;
	// oversizing costs ~1 KiB for a 100-row chunk. Right-size to the common case.
	sb.Grow(128 + len(rows)*220)
	args := make([]any, 0, len(rows)*10+2)

	// Postgres can't infer that a parameterized THEN value inside a CASE is
	// bytea — it defaults to text and then rejects the UPDATE because the
	// target column is bytea. An explicit ::bytea cast on the bytes branch
	// resolves the inference. MySQL/SQLite don't need (and don't support
	// identically) the cast, so it's emitted only on Postgres.
	byteaCast := ""
	if ph == sq.Dollar {
		byteaCast = "::bytea"
	}

	writeCase := func(col string, cast string, valueFor func(contracts.BulkUpdateRow) any) {
		sb.WriteString(col)
		sb.WriteString(" = (CASE")
		for _, r := range rows {
			sb.WriteString(" WHEN namespace = ? AND name = ? AND version = ? THEN ?")
			sb.WriteString(cast)
			args = append(args, namespace, r.Name, r.Version, valueFor(r))
		}
		sb.WriteString(" END)")
	}

	sb.WriteString("UPDATE ")
	sb.WriteString(tableEncryptedValue)
	sb.WriteString(" SET ")
	writeCase("encrypted_data", byteaCast, func(r contracts.BulkUpdateRow) any { return r.Payload.EncryptedData })
	sb.WriteString(", ")
	writeCase("data_key_id", "", func(r contracts.BulkUpdateRow) any { return r.Payload.DataKeyID })
	sb.WriteString(", updated = ")
	sb.WriteString("?")
	args = append(args, updated)

	// Row-constructor IN comparisons are too dialect-sensitive: Postgres needs
	// row-value syntax, MySQL 8.0.19+ requires explicit ROW(...) inside VALUES,
	// and SQLite accepts neither uniformly. Expanding to namespace = ? AND
	// ((name = ? AND version = ?) OR ...) works identically on all three and
	// hits the (namespace, name, version) unique index on each branch.
	sb.WriteString(" WHERE namespace = ? AND (")
	args = append(args, namespace)
	for i, r := range rows {
		if i > 0 {
			sb.WriteString(" OR ")
		}
		sb.WriteString("(name = ? AND version = ?)")
		args = append(args, r.Name, r.Version)
	}
	sb.WriteString(")")

	query, err := ph.ReplacePlaceholders(sb.String())
	if err != nil {
		return "", nil, err
	}
	return query, args, nil
}

func (s *encryptedValStorage) Get(ctx context.Context, namespace xkube.Namespace, name string, version int64) (*contracts.EncryptedValue, error) {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Get", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	query, args, err := s.builder.
		Select(encryptedValueColumns...).
		From(tableEncryptedValue).
		Where(sq.Eq{
			"namespace": namespace.String(),
			"name":      name,
			"version":   version,
		}).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("building select: %w", err)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("getting row: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return nil, ErrEncryptedValueNotFound
	}

	var encryptedValue EncryptedValue
	err = rows.Scan(&encryptedValue.Namespace, &encryptedValue.Name, &encryptedValue.Version, &encryptedValue.EncryptedData, &encryptedValue.DataKeyID, &encryptedValue.Created, &encryptedValue.Updated)
	if err != nil {
		return nil, fmt.Errorf("failed to scan encrypted value row: %w", err)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return &contracts.EncryptedValue{
		Namespace: encryptedValue.Namespace,
		Name:      encryptedValue.Name,
		Version:   encryptedValue.Version,
		EncryptedPayload: contracts.EncryptedPayload{
			DataKeyID:     encryptedValue.DataKeyID,
			EncryptedData: encryptedValue.EncryptedData,
		},
		Created: encryptedValue.Created,
		Updated: encryptedValue.Updated,
	}, nil
}

func (s *encryptedValStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string, version int64) error {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Delete", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	query, args, err := s.builder.
		Delete(tableEncryptedValue).
		Where(sq.Eq{
			"namespace": namespace.String(),
			"name":      name,
			"version":   version,
		}).
		ToSql()
	if err != nil {
		return fmt.Errorf("building delete: %w", err)
	}

	if _, err = s.db.ExecContext(ctx, query, args...); err != nil {
		return fmt.Errorf("deleting row: %w", err)
	}

	return nil
}

type globalEncryptedValStorage struct {
	db      contracts.Database
	builder sq.StatementBuilderType
	tracer  trace.Tracer
}

func ProvideGlobalEncryptedValueStorage(
	db contracts.Database,
	tracer trace.Tracer,
) (contracts.GlobalEncryptedValueStorage, error) {
	builder, _ := database.NewBuilder(db.DriverName())
	return &globalEncryptedValStorage{
		db:      db,
		builder: builder,
		tracer:  tracer,
	}, nil
}

func (s *globalEncryptedValStorage) ListAll(ctx context.Context, opts contracts.ListOpts, untilTime *int64) ([]*contracts.EncryptedValue, error) {
	if opts.OrderBy == "" {
		opts.OrderBy = "created"
	}
	if _, ok := allowedListAllOrderBy[opts.OrderBy]; !ok {
		return nil, fmt.Errorf("invalid OrderBy %q", opts.OrderBy)
	}
	if opts.OrderDirection == "" {
		opts.OrderDirection = contracts.OrderDirectionAsc
	}
	if opts.OrderDirection != contracts.OrderDirectionAsc && opts.OrderDirection != contracts.OrderDirectionDesc {
		return nil, fmt.Errorf("invalid OrderDirection %q", opts.OrderDirection)
	}
	attrs := []attribute.KeyValue{
		attribute.Int64("limit", opts.Limit),
		attribute.Int64("offset", opts.Offset),
		attribute.String("orderBy", opts.OrderBy),
		attribute.String("orderDirection", string(opts.OrderDirection)),
	}
	if untilTime != nil {
		attrs = append(attrs, attribute.Int64("untilTime", *untilTime))
	}
	ctx, span := s.tracer.Start(ctx, "GlobalEncryptedValueStorage.CountAll", trace.WithAttributes(attrs...))
	defer span.End()

	q := s.builder.
		Select(encryptedValueColumns...).
		From(tableEncryptedValue).
		OrderBy(fmt.Sprintf("%s %s", opts.OrderBy, opts.OrderDirection))
	if untilTime != nil {
		q = q.Where(sq.LtOrEq{"created": *untilTime})
	}
	if opts.Limit > 0 {
		q = q.Limit(uint64(opts.Limit)).Offset(uint64(opts.Offset))
	}

	query, args, err := q.ToSql()
	if err != nil {
		return nil, fmt.Errorf("building list: %w", err)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing encrypted values: %w", err)
	}
	defer func() { _ = rows.Close() }()

	encryptedValues := make([]*contracts.EncryptedValue, 0)
	for rows.Next() {
		var row EncryptedValue
		err = rows.Scan(
			&row.Namespace,
			&row.Name,
			&row.Version,
			&row.EncryptedData,
			&row.DataKeyID,
			&row.Created,
			&row.Updated,
		)
		if err != nil {
			return nil, fmt.Errorf("error reading data key row: %w", err)
		}

		encryptedValues = append(encryptedValues, &contracts.EncryptedValue{
			Namespace: row.Namespace,
			Name:      row.Name,
			Version:   row.Version,
			EncryptedPayload: contracts.EncryptedPayload{
				DataKeyID:     row.DataKeyID,
				EncryptedData: row.EncryptedData,
			},
			Created: row.Created,
			Updated: row.Updated,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return encryptedValues, nil
}

func (s *globalEncryptedValStorage) CountAll(ctx context.Context, untilTime *int64) (int64, error) {
	attrs := []attribute.KeyValue{}
	if untilTime != nil {
		attrs = append(attrs, attribute.Int64("untilTime", *untilTime))
	}
	ctx, span := s.tracer.Start(ctx, "GlobalEncryptedValueStorage.CountAll", trace.WithAttributes(attrs...))
	defer span.End()

	q := s.builder.Select("COUNT(*) AS count").From(tableEncryptedValue)
	if untilTime != nil {
		q = q.Where(sq.LtOrEq{"created": *untilTime})
	}

	query, args, err := q.ToSql()
	if err != nil {
		return 0, fmt.Errorf("building count: %w", err)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("getting row: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return 0, fmt.Errorf("no rows returned when counting encrypted values")
	}

	var count int64
	err = rows.Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to scan encrypted value row: %w", err)
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("read rows error: %w", err)
	}

	return count, nil
}

type encryptedValMigrationExecutor struct {
	db                  contracts.Database
	tracer              trace.Tracer
	encryptedValueStore contracts.EncryptedValueStorage
	globalStore         contracts.GlobalEncryptedValueStorage
}

func ProvideEncryptedValueMigrationExecutor(
	db contracts.Database,
	tracer trace.Tracer,
	encryptedValueStore contracts.EncryptedValueStorage,
	globalStore contracts.GlobalEncryptedValueStorage,
) (contracts.EncryptedValueMigrationExecutor, error) {
	return &encryptedValMigrationExecutor{
		db:                  db,
		tracer:              tracer,
		encryptedValueStore: encryptedValueStore,
		globalStore:         globalStore,
	}, nil
}

func (s *encryptedValMigrationExecutor) Execute(ctx context.Context) (int, error) {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueMigrationExecutor.Execute")
	defer span.End()

	// 1. Retrieve all encrypted values
	encryptedValues, err := s.globalStore.ListAll(ctx, contracts.ListOpts{}, nil)
	if err != nil {
		return 0, fmt.Errorf("listing all encrypted values: %w", err)
	}

	// This doesn't need to be done in a single transaction because there's no risk to successful rows if other rows fail
	rowsAffected := 0
	for _, encryptedValue := range encryptedValues {
		// 2. If the value already has the data key id broken out, skip it
		if encryptedValue.DataKeyID != "" {
			continue
		}

		// 3. Split the data key id and the encrypted data out from the encoded payload
		payload := encryptedValue.EncryptedData
		const keyIdDelimiter = '#'
		payload = payload[1:]
		endOfKey := bytes.Index(payload, []byte{keyIdDelimiter})
		if endOfKey == -1 {
			return rowsAffected, fmt.Errorf("could not find valid key id in encrypted payload with namespace %s and name %s and version %d", encryptedValue.Namespace, encryptedValue.Name, encryptedValue.Version)
		}
		b64Key := payload[:endOfKey]
		encryptedData := payload[endOfKey+1:]
		if len(encryptedData) == 0 {
			return rowsAffected, fmt.Errorf("encrypted data is empty with namespace %s and name %s and version %d", encryptedValue.Namespace, encryptedValue.Name, encryptedValue.Version)
		}
		keyId := make([]byte, base64.RawStdEncoding.DecodedLen(len(b64Key)))
		_, err := base64.RawStdEncoding.Decode(keyId, b64Key)
		if err != nil {
			return rowsAffected, fmt.Errorf("decoding key id with namespace %s and name %s and version %d: %w", encryptedValue.Namespace, encryptedValue.Name, encryptedValue.Version, err)
		}

		// 4. Update the encrypted value with the data key id and the encrypted data
		err = s.encryptedValueStore.Update(ctx, xkube.Namespace(encryptedValue.Namespace), encryptedValue.Name, encryptedValue.Version, contracts.EncryptedPayload{
			DataKeyID:     string(keyId),
			EncryptedData: encryptedData,
		})
		if err != nil {
			return rowsAffected, fmt.Errorf("updating encrypted value with namespace %s and name %s and version %d: %w", encryptedValue.Namespace, encryptedValue.Name, encryptedValue.Version, err)
		}
		rowsAffected++
	}

	return rowsAffected, nil
}
