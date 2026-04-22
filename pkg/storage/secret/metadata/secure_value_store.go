package metadata

import (
	"context"
	"fmt"
	"strconv"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-app-sdk/logging"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/metadata/metrics"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
)

const tableSecureValue = "secret_secure_value"

// secureValueReadColumns is the read column set for Read / readActiveVersion.
// Order matters: it must match the Scan arguments.
var secureValueReadColumns = []string{
	"guid", "name", "namespace", "annotations", "labels",
	"created", "created_by", "updated", "updated_by",
	"description", "keeper", "decrypters", "ref", "external_id",
	"active", "version",
	"owner_reference_api_group", "owner_reference_api_version",
	"owner_reference_kind", "owner_reference_name",
}

// secureValueListColumns is the read column set for List / listByLeaseToken.
// Version and active are intentionally swapped vs secureValueReadColumns to
// match the Scan order the list callers rely on.
var secureValueListColumns = []string{
	"guid", "name", "namespace", "annotations", "labels",
	"created", "created_by", "updated", "updated_by",
	"description", "keeper", "decrypters", "ref", "external_id",
	"version", "active",
	"owner_reference_api_group", "owner_reference_api_version",
	"owner_reference_kind", "owner_reference_name",
}

var _ contracts.SecureValueMetadataStorage = (*secureValueMetadataStorage)(nil)

func ProvideSecureValueMetadataStorage(
	clock contracts.Clock,
	db contracts.Database,
	tracer trace.Tracer,
	reg prometheus.Registerer,
) (contracts.SecureValueMetadataStorage, error) {
	builder, ph := database.NewBuilder(db.DriverName())
	return &secureValueMetadataStorage{
		clock:   clock,
		db:      db,
		builder: builder,
		ph:      ph,
		driver:  db.DriverName(),
		metrics: metrics.NewStorageMetrics(reg),
		tracer:  tracer,
	}, nil
}

// secureValueMetadataStorage is the actual implementation of the secure value (metadata) storage.
type secureValueMetadataStorage struct {
	clock   contracts.Clock
	db      contracts.Database
	builder sq.StatementBuilderType
	ph      sq.PlaceholderFormat
	driver  string
	metrics *metrics.StorageMetrics
	tracer  trace.Tracer
}

func (s *secureValueMetadataStorage) Create(ctx context.Context, keeper string, sv *secretv1beta1.SecureValue, actorUID string) (_ *secretv1beta1.SecureValue, svmCreateErr error) {
	start := s.clock.Now()
	name := sv.GetName()
	namespace := sv.GetNamespace()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.Create", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace),
		attribute.String("keeper", keeper),
		attribute.String("actorUID", actorUID),
	))
	defer span.End()

	defer func() {
		success := svmCreateErr == nil

		args := []any{
			"name", name,
			"namespace", namespace,
			"keeper", keeper,
			"actorUID", actorUID,
		}

		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "SecureValueMetadataStorage.Create failed")
			span.RecordError(svmCreateErr)
			args = append(args, "error", svmCreateErr)
		}

		logging.FromContext(ctx).Info("SecureValueMetadataStorage.Create", args...)

		s.metrics.SecureValueMetadataCreateDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	latest, err := s.getLatestVersionAndCreated(ctx, xkube.Namespace(sv.Namespace), sv.Name)
	if err != nil {
		return nil, fmt.Errorf("fetching latest secure value version: %w", err)
	}

	version := int64(1)
	if latest.version > 0 {
		version = latest.version + 1
	}

	// Some other concurrent request may have created the version we're trying to create,
	// if that's the case, we'll retry with a new version up to max attempts.
	maxAttempts := 3
	attempts := 0
	for {
		sv.Status.Version = version

		now := s.clock.Now().UTC().Unix()

		createdAt := now
		if latest.createdAt > 0 {
			createdAt = latest.createdAt
		}
		updatedAt := now

		createdBy := actorUID
		if latest.createdBy != "" {
			createdBy = latest.createdBy
		}
		updatedBy := actorUID

		row, err := toCreateRow(createdAt, updatedAt, keeper, sv, createdBy, updatedBy)
		if err != nil {
			return nil, fmt.Errorf("to create row: %w", err)
		}

		query, queryArgs, err := buildSecureValueInsert(s.builder, row)
		if err != nil {
			return nil, fmt.Errorf("building insert: %w", err)
		}

		res, err := s.db.ExecContext(ctx, query, queryArgs...)
		if err != nil {
			if sql.IsRowAlreadyExistsError(err) {
				if attempts < maxAttempts {
					attempts += 1
					version += 1
					continue
				}
				return nil, fmt.Errorf("namespace=%+v name=%+v %w", sv.Namespace, sv.Name, contracts.ErrSecureValueAlreadyExists)
			}
			return nil, fmt.Errorf("inserting row: %w", err)
		}

		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return nil, fmt.Errorf("getting rows affected: %w", err)
		}

		if rowsAffected != 1 {
			return nil, fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, row.Name, row.Namespace)
		}

		createdSecureValue, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("convert to kubernetes object: %w", err)
		}

		return createdSecureValue, nil
	}
}

// buildSecureValueInsert assembles an INSERT that omits nullable columns when
// their sql.NullString is invalid, to keep NULL handling consistent across
// backends (some dialects differ on how explicit NULLs interact with defaults).
func buildSecureValueInsert(b sq.StatementBuilderType, row *secureValueDB) (string, []any, error) {
	cols := []string{
		"guid", "name", "namespace", "annotations", "labels",
		"created", "created_by", "updated", "updated_by",
		"active", "version", "description",
	}
	vals := []any{
		row.GUID, row.Name, row.Namespace, row.Annotations, row.Labels,
		row.Created, row.CreatedBy, row.Updated, row.UpdatedBy,
		row.Active, row.Version, row.Description,
	}

	if row.Keeper.Valid {
		cols = append(cols, "keeper")
		vals = append(vals, row.Keeper.String)
	}
	if row.Decrypters.Valid {
		cols = append(cols, "decrypters")
		vals = append(vals, row.Decrypters.String)
	}
	if row.Ref.Valid {
		cols = append(cols, "ref")
		vals = append(vals, row.Ref.String)
	}
	if row.OwnerReferenceAPIGroup.Valid {
		cols = append(cols, "owner_reference_api_group")
		vals = append(vals, row.OwnerReferenceAPIGroup.String)
	}
	if row.OwnerReferenceAPIVersion.Valid {
		cols = append(cols, "owner_reference_api_version")
		vals = append(vals, row.OwnerReferenceAPIVersion.String)
	}
	if row.OwnerReferenceKind.Valid {
		cols = append(cols, "owner_reference_kind")
		vals = append(vals, row.OwnerReferenceKind.String)
	}
	if row.OwnerReferenceName.Valid {
		cols = append(cols, "owner_reference_name")
		vals = append(vals, row.OwnerReferenceName.String)
	}

	cols = append(cols, "external_id")
	vals = append(vals, row.ExternalID)

	return b.Insert(tableSecureValue).Columns(cols...).Values(vals...).ToSql()
}

type versionAndCreated struct {
	createdAt int64
	createdBy string
	version   int64
}

func (s *secureValueMetadataStorage) getLatestVersionAndCreated(ctx context.Context, namespace xkube.Namespace, name string) (versionAndCreated, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.getLatestVersionAndCreated", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	query, args, err := s.builder.
		Select("created", "created_by", "version", "active", "namespace", "name").
		From(tableSecureValue).
		Where(sq.Eq{"namespace": namespace.String(), "name": name}).
		OrderBy("version DESC").
		Limit(1).
		ToSql()
	if err != nil {
		return versionAndCreated{}, fmt.Errorf("building latest-version select: %w", err)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return versionAndCreated{}, fmt.Errorf("fetching latest version for secure value: namespace=%+v name=%+v %w", namespace, name, err)
	}
	defer func() { _ = rows.Close() }()

	if err := rows.Err(); err != nil {
		return versionAndCreated{}, fmt.Errorf("error executing query: %w", err)
	}

	if !rows.Next() {
		return versionAndCreated{}, nil
	}

	var (
		createdAt       int64
		createdBy       string
		version         int64
		active          bool
		namespaceFromDB string
		nameFromDB      string
	)
	if err := rows.Scan(&createdAt, &createdBy, &version, &active, &namespaceFromDB, &nameFromDB); err != nil {
		return versionAndCreated{}, fmt.Errorf("scanning version and created from returned rows: %w", err)
	}

	if namespaceFromDB != namespace.String() || nameFromDB != name {
		return versionAndCreated{}, fmt.Errorf("bug: expected to find version and created for namespace=%+v name=%+v but got for namespace=%+v name=%+v",
			namespace, name, namespaceFromDB, nameFromDB)
	}

	if !active {
		createdAt = 0
		createdBy = ""
	}

	return versionAndCreated{
		createdAt: createdAt,
		createdBy: createdBy,
		version:   version,
	}, nil
}

func (s *secureValueMetadataStorage) readActiveVersion(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (secureValueDB, error) {
	q := s.builder.
		Select(secureValueReadColumns...).
		From(tableSecureValue).
		Where(sq.Eq{"namespace": namespace.String(), "name": name, "active": true})
	if opts.ForUpdate {
		q = database.ApplyForUpdate(q, s.driver)
	}

	query, args, err := q.ToSql()
	if err != nil {
		return secureValueDB{}, fmt.Errorf("building select: %w", err)
	}

	res, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return secureValueDB{}, fmt.Errorf("reading row: %w", err)
	}
	defer func() { _ = res.Close() }()

	var secureValue secureValueDB
	if !res.Next() {
		return secureValueDB{}, contracts.ErrSecureValueNotFound
	}

	if err := res.Scan(
		&secureValue.GUID, &secureValue.Name, &secureValue.Namespace,
		&secureValue.Annotations, &secureValue.Labels,
		&secureValue.Created, &secureValue.CreatedBy,
		&secureValue.Updated, &secureValue.UpdatedBy,
		&secureValue.Description, &secureValue.Keeper, &secureValue.Decrypters, &secureValue.Ref, &secureValue.ExternalID, &secureValue.Active, &secureValue.Version,
		&secureValue.OwnerReferenceAPIGroup, &secureValue.OwnerReferenceAPIVersion, &secureValue.OwnerReferenceKind, &secureValue.OwnerReferenceName,
	); err != nil {
		return secureValueDB{}, fmt.Errorf("failed to scan secure value row: %w", err)
	}

	if err := res.Err(); err != nil {
		return secureValueDB{}, fmt.Errorf("read rows error: %w", err)
	}

	if secureValue.Namespace != namespace.String() || secureValue.Name != name {
		return secureValueDB{}, fmt.Errorf("bug: expected to read secure value %+v from namespace %+v, but got a different row", name, namespace)
	}

	return secureValue, nil
}

func (s *secureValueMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (_ *secretv1beta1.SecureValue, readErr error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.Read", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.Bool("isForUpdate", opts.ForUpdate),
	))
	defer span.End()

	defer func() {
		success := readErr == nil

		args := []any{
			"name", name,
			"namespace", namespace.String(),
			"success", success,
		}

		if !success {
			span.SetStatus(codes.Error, "SecureValueMetadataStorage.Read failed")
			span.RecordError(readErr)
			args = append(args, "error", readErr)
		}

		logging.FromContext(ctx).Info("SecureValueMetadataStorage.Read", args...)
		s.metrics.SecureValueMetadataGetDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	secureValue, err := s.readActiveVersion(ctx, namespace, name, opts)
	if err != nil {
		return nil, err
	}

	secureValueKub, err := secureValue.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return secureValueKub, nil
}

func (s *secureValueMetadataStorage) List(ctx context.Context, namespace xkube.Namespace) (svList []secretv1beta1.SecureValue, listErr error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.List", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	defer func() {
		success := listErr == nil
		span.SetAttributes(attribute.Int("returnedList.count", len(svList)))

		args := []any{
			"namespace", namespace.String(),
			"success", success,
		}

		if !success {
			span.SetStatus(codes.Error, "SecureValueMetadataStorage.List failed")
			span.RecordError(listErr)
			args = append(args, "error", listErr)
		}

		logging.FromContext(ctx).Info("SecureValueMetadataStorage.List", args...)

		s.metrics.SecureValueMetadataListDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	query, args, err := s.builder.
		Select(secureValueListColumns...).
		From(tableSecureValue).
		Where(sq.Eq{"namespace": namespace.String(), "active": true}).
		OrderBy("updated DESC").
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("building list: %w", err)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing secure values: %w", err)
	}
	defer func() { _ = rows.Close() }()

	secureValues := make([]secretv1beta1.SecureValue, 0)
	for rows.Next() {
		row := secureValueDB{}

		err = rows.Scan(&row.GUID,
			&row.Name, &row.Namespace, &row.Annotations,
			&row.Labels,
			&row.Created, &row.CreatedBy,
			&row.Updated, &row.UpdatedBy,
			&row.Description, &row.Keeper, &row.Decrypters,
			&row.Ref, &row.ExternalID, &row.Version, &row.Active,
			&row.OwnerReferenceAPIGroup, &row.OwnerReferenceAPIVersion, &row.OwnerReferenceKind, &row.OwnerReferenceName,
		)

		if err != nil {
			return nil, fmt.Errorf("error reading secure value row: %w", err)
		}

		if !row.Active {
			return nil, fmt.Errorf("bug: read an inactive version: row=%+v", row)
		}

		if row.Namespace != namespace.String() {
			return nil, fmt.Errorf("bug: expected to list secure values from namespace %+v but got one from namespace %+v", namespace.String(), row.Namespace)
		}

		secureValue, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("convert to kubernetes object: %w", err)
		}

		secureValues = append(secureValues, *secureValue)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return secureValues, nil
}

func (s *secureValueMetadataStorage) SetVersionToActive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error {
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.SetVersionToActive", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.Int64("version", version),
	))
	defer span.End()

	query, args, err := s.builder.
		Update(tableSecureValue).
		Set("active", sq.Expr("(version = ?)", version)).
		Where(sq.Eq{"namespace": namespace.String(), "name": name}).
		ToSql()
	if err != nil {
		return fmt.Errorf("building set-version-to-active: %w", err)
	}

	res, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("setting secure value version to active: namespace=%+v name=%+v version=%+v %w", namespace, name, version, err)
	}

	// validate modified count
	modifiedCount, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("fetching number of modified rows: %w", err)
	}
	if modifiedCount == 0 {
		return fmt.Errorf("expected to modify at least one row but modified 0: modifiedCount=%d", modifiedCount)
	}

	return nil
}

func (s *secureValueMetadataStorage) SetVersionToInactive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error {
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.SetVersionToInactive", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.Int64("version", version),
	))
	defer span.End()

	query, args, err := s.builder.
		Update(tableSecureValue).
		Set("active", false).
		Where(sq.Eq{"namespace": namespace.String(), "name": name, "version": version}).
		ToSql()
	if err != nil {
		return fmt.Errorf("building set-version-to-inactive: %w", err)
	}

	res, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("setting secure value version to active: namespace=%+v name=%+v version=%+v %w", namespace, name, version, err)
	}

	modifiedCount, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("fetching number of modified rows: %w", err)
	}
	if modifiedCount > 1 {
		return fmt.Errorf("expected to modify at at most one row but modified more: modifiedCount=%d", modifiedCount)
	}

	return nil
}

func (s *secureValueMetadataStorage) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, version int64, externalID contracts.ExternalID) (setExtIDErr error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.SetExternalID", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.String("externalID", externalID.String()),
		attribute.Int64("version", version),
	))

	defer span.End()

	defer func() {
		success := setExtIDErr == nil
		args := []any{
			"name", name,
			"namespace", namespace.String(),
			"success", success,
			"version", strconv.FormatInt(version, 10),
			"externalID", externalID.String(),
		}

		if !success {
			span.SetStatus(codes.Error, "SecureValueMetadataStorage.SetExternalID failed")
			span.RecordError(setExtIDErr)
			args = append(args, "error", setExtIDErr)
		}

		logging.FromContext(ctx).Info("SecureValueMetadataStorage.SetExternalID", args...)
		s.metrics.SecureValueSetExternalIDDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	query, args, err := s.builder.
		Update(tableSecureValue).
		Set("external_id", externalID.String()).
		Where(sq.Eq{"namespace": namespace.String(), "name": name, "version": version}).
		ToSql()
	if err != nil {
		return fmt.Errorf("building update external id: %w", err)
	}

	res, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("setting secure value external id: namespace=%+v name=%+v externalID=%+v %w", namespace, name, externalID, err)
	}

	modifiedCount, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting updated rows update external id secure value: %w", err)
	}
	if modifiedCount > 1 {
		return fmt.Errorf("secureValueMetadataStorage.SetExternalID: modified more than one secret, this is a bug, check the where condition: modifiedCount=%d", modifiedCount)
	}

	return nil
}

func (s *secureValueMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string, version int64) (err error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.Delete", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.Int64("version", version),
	))

	defer span.End()

	defer func() {
		success := err == nil
		args := []any{
			"namespace", namespace.String(),
			"name", name,
			"version", strconv.FormatInt(version, 10),
			"success", success,
		}

		if !success {
			span.SetStatus(codes.Error, "SecureValueMetadataStorage.Delete failed")
			span.RecordError(err)
			args = append(args, "error", err)
		}

		logging.FromContext(ctx).Info("SecureValueMetadataStorage.Delete", args...)
		s.metrics.SecureValueDeleteDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	query, queryArgs, err := s.builder.
		Delete(tableSecureValue).
		Where(sq.Eq{"namespace": namespace.String(), "name": name, "version": version}).
		ToSql()
	if err != nil {
		return fmt.Errorf("building delete: %w", err)
	}

	res, err := s.db.ExecContext(ctx, query, queryArgs...)
	if err != nil {
		return fmt.Errorf("deleting secure value: namespace=%+v name=%+v version=%+v %w", namespace, name, version, err)
	}

	modifiedCount, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}
	// Deleting is idempotent so modifiedCunt must be in {0, 1}
	if modifiedCount > 1 {
		return fmt.Errorf("secureValueMetadataStorage.Delete: delete more than one secret, this is a bug, check the where condition: modifiedCount=%d", modifiedCount)
	}

	return nil
}

func (s *secureValueMetadataStorage) SetInactiveAllFromGroup(ctx context.Context, namespace xkube.Namespace, apiGroup string) (err error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.SetInactiveAllFromGroup", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("apiGroup", apiGroup),
	))

	defer span.End()

	defer func() {
		success := err == nil
		args := []any{
			"namespace", namespace.String(),
			"apiGroup", apiGroup,
			"success", success,
		}

		if !success {
			span.SetStatus(codes.Error, "SecureValueMetadataStorage.SetInactiveAllFromGroup failed")
			span.RecordError(err)
			args = append(args, "error", err)
		}

		logging.FromContext(ctx).Debug("SecureValueMetadataStorage.SetInactiveAllFromGroup", args...)
		s.metrics.SecureValueSetInactiveAllFromGroupDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	query, args, err := s.builder.
		Update(tableSecureValue).
		Set("active", false).
		Where(sq.Eq{"namespace": namespace.String(), "owner_reference_api_group": apiGroup, "active": true}).
		ToSql()
	if err != nil {
		return fmt.Errorf("building update: %w", err)
	}

	if _, err := s.db.ExecContext(ctx, query, args...); err != nil {
		return fmt.Errorf("setting inactive all secure values from group %q in namespace %q: %w", apiGroup, namespace, err)
	}

	return nil
}

func (s *secureValueMetadataStorage) LeaseInactiveSecureValues(ctx context.Context, maxBatchSize uint16) (out []secretv1beta1.SecureValue, err error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.LeaseInactiveSecureValues", trace.WithAttributes(
		attribute.Int("maxBatchSize", int(maxBatchSize)),
	))

	defer span.End()

	defer func() {
		success := err == nil

		if !success {
			span.SetStatus(codes.Error, "SecureValueMetadataStorage.LeaseInactiveSecureValues failed")
			span.RecordError(err)
		}

		s.metrics.SecureValueDeleteDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	leaseToken := uuid.NewString()
	if err := s.acquireLeases(ctx, leaseToken, maxBatchSize); err != nil {
		return nil, fmt.Errorf("acquiring leases for inactive secure values: %w", err)
	}

	secureValues, err := s.listByLeaseToken(ctx, leaseToken)
	if err != nil {
		return nil, fmt.Errorf("fetching secure values by lease token: %w", err)
	}

	return secureValues, nil
}

func (s *secureValueMetadataStorage) acquireLeases(ctx context.Context, leaseToken string, maxBatchSize uint16) error {
	const minAge int64 = 300  // seconds; inactive rows younger than this are skipped.
	const leaseTTL int64 = 30 // seconds; leases older than this can be re-acquired.
	now := s.clock.Now().UTC().Unix()

	// The lease query uses a ROW_NUMBER() window function in a subquery to cap
	// the batch size. Squirrel does not model window functions, so the SQL is
	// authored by hand with `?` placeholders and rewritten for the driver.
	const rawSQL = `UPDATE secret_secure_value ` +
		`SET lease_token = ?, lease_created = ? ` +
		`WHERE guid IN (` +
		`SELECT guid FROM (` +
		`SELECT guid, ROW_NUMBER() OVER (ORDER BY created ASC) AS rn ` +
		`FROM secret_secure_value ` +
		`WHERE active = FALSE AND ? - updated > ? AND ? - lease_created > ?` +
		`) AS sub ` +
		`WHERE rn <= ?` +
		`)`

	query, err := s.ph.ReplacePlaceholders(rawSQL)
	if err != nil {
		return fmt.Errorf("rebinding lease query: %w", err)
	}

	args := []any{leaseToken, now, now, minAge, now, leaseTTL, maxBatchSize}
	if _, err := s.db.ExecContext(ctx, query, args...); err != nil {
		return fmt.Errorf("leasing inactive secure values: %w", err)
	}

	return nil
}

func (s *secureValueMetadataStorage) listByLeaseToken(ctx context.Context, leaseToken string) ([]secretv1beta1.SecureValue, error) {
	cols := append([]string{}, secureValueListColumns...)
	cols = append(cols, "lease_token")

	query, args, err := s.builder.
		Select(cols...).
		From(tableSecureValue).
		Where(sq.Eq{"lease_token": leaseToken}).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("building list-by-lease-token: %w", err)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing secure values: %w", err)
	}
	defer func() { _ = rows.Close() }()

	secureValues := make([]secretv1beta1.SecureValue, 0)
	for rows.Next() {
		row := secureValueDB{}
		var leaseTokenDB string

		err = rows.Scan(&row.GUID,
			&row.Name, &row.Namespace, &row.Annotations,
			&row.Labels,
			&row.Created, &row.CreatedBy,
			&row.Updated, &row.UpdatedBy,
			&row.Description, &row.Keeper, &row.Decrypters,
			&row.Ref, &row.ExternalID, &row.Version, &row.Active,
			&row.OwnerReferenceAPIGroup, &row.OwnerReferenceAPIVersion, &row.OwnerReferenceKind, &row.OwnerReferenceName,
			&leaseTokenDB,
		)

		if err != nil {
			return nil, fmt.Errorf("error reading secure value row: %w", err)
		}

		if leaseTokenDB != leaseToken {
			return nil, fmt.Errorf("bug: expected to list secure values with lease token %+v but got a secure value with another lease token %+v", leaseToken, leaseTokenDB)
		}

		secureValue, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("convert to kubernetes object: %w", err)
		}

		secureValues = append(secureValues, *secureValue)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return secureValues, nil
}
