package metadata

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/metadata/metrics"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var _ contracts.SecureValueMetadataStorage = (*secureValueMetadataStorage)(nil)

func ProvideSecureValueMetadataStorage(
	db contracts.Database,
	tracer trace.Tracer,
	reg prometheus.Registerer,
) (contracts.SecureValueMetadataStorage, error) {
	return &secureValueMetadataStorage{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		metrics: metrics.NewStorageMetrics(reg),
		tracer:  tracer,
	}, nil
}

// secureValueMetadataStorage is the actual implementation of the secure value (metadata) storage.
type secureValueMetadataStorage struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
	metrics *metrics.StorageMetrics
	tracer  trace.Tracer
}

func (s *secureValueMetadataStorage) Create(ctx context.Context, sv *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.Create", trace.WithAttributes(
		attribute.String("name", sv.GetName()),
		attribute.String("namespace", sv.GetNamespace()),
		attribute.String("actorUID", actorUID),
	))
	defer span.End()

	// Set inside of the transaction callback
	var row *secureValueDB

	err := s.db.Transaction(ctx, func(ctx context.Context) error {
		if sv.Spec.Keeper != nil {
			// Validate before inserting that the chosen `keeper` exists.

			// -- This is a copy of KeeperMetadataStore.read, which is not public at the moment, and is not defined in contract.KeeperMetadataStorage
			req := &readKeeper{
				SQLTemplate: sqltemplate.New(s.dialect),
				Namespace:   sv.Namespace,
				Name:        *sv.Spec.Keeper,
				IsForUpdate: true,
			}

			query, err := sqltemplate.Execute(sqlKeeperRead, req)
			if err != nil {
				return fmt.Errorf("execute template %q: %w", sqlKeeperRead.Name(), err)
			}

			res, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
			if err != nil {
				return fmt.Errorf("getting row: %w", err)
			}
			defer func() { _ = res.Close() }()

			if !res.Next() {
				return contracts.ErrKeeperNotFound
			}
		}

		latestVersion, err := s.getLatestVersion(ctx, xkube.Namespace(sv.Namespace), sv.Name)
		if err != nil {
			return fmt.Errorf("fetching latest secure value version: %w", err)
		}

		version := int64(1)
		if latestVersion != nil {
			version = *latestVersion + 1
		}

		// Some other concurrent request may have created the version we're trying to create,
		// if that's the case, we'll retry with a new version up to max attempts.
		maxAttempts := 3
		attempts := 0
		for {
			sv.Status.Version = version

			row, err = toCreateRow(sv, actorUID)
			if err != nil {
				return fmt.Errorf("to create row: %w", err)
			}

			req := createSecureValue{
				SQLTemplate: sqltemplate.New(s.dialect),
				Row:         row,
			}

			query, err := sqltemplate.Execute(sqlSecureValueCreate, req)
			if err != nil {
				return fmt.Errorf("execute template %q: %w", sqlSecureValueCreate.Name(), err)
			}

			res, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
			if err != nil {
				if sql.IsRowAlreadyExistsError(err) {
					if attempts < maxAttempts {
						attempts += 1
						version += 1
						continue
					}
					return fmt.Errorf("namespace=%+v name=%+v %w", sv.Namespace, sv.Name, contracts.ErrSecureValueAlreadyExists)
				}
				return fmt.Errorf("inserting row: %w", err)
			}

			rowsAffected, err := res.RowsAffected()
			if err != nil {
				return fmt.Errorf("getting rows affected: %w", err)
			}

			if rowsAffected != 1 {
				return fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, row.Name, row.Namespace)
			}
			return nil
		}
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	createdSecureValue, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	s.metrics.SecureValueMetadataCreateDuration.Observe(time.Since(start).Seconds())
	s.metrics.SecureValueMetadataCreateCount.Inc()

	return createdSecureValue, nil
}

func (s *secureValueMetadataStorage) getLatestVersion(ctx context.Context, namespace xkube.Namespace, name string) (*int64, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.getLatestVersion", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	req := getLatestSecureValueVersion{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
	}

	q, err := sqltemplate.Execute(sqlGetLatestSecureValueVersion, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlGetLatestSecureValueVersion.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("fetching latest version for secure value: namespace=%+v name=%+v %w", namespace, name, err)
	}
	defer func() { _ = rows.Close() }()

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error executing query: %w", err)
	}

	if !rows.Next() {
		return nil, nil
	}

	var version int64
	if err := rows.Scan(&version); err != nil {
		return nil, fmt.Errorf("scanning version from returned rows: %w", err)
	}

	return &version, nil
}

func (s *secureValueMetadataStorage) readActiveVersion(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (secureValueDB, error) {
	req := readSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
		IsForUpdate: opts.ForUpdate,
	}

	query, err := sqltemplate.Execute(sqlSecureValueRead, req)
	if err != nil {
		return secureValueDB{}, fmt.Errorf("execute template %q: %w", sqlSecureValueRead.Name(), err)
	}

	res, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return secureValueDB{}, fmt.Errorf("reading row: %w", err)
	}
	defer func() { _ = res.Close() }()

	if !res.Next() {
		return secureValueDB{}, contracts.ErrSecureValueNotFound
	}

	var secureValue secureValueDB
	if err := res.Scan(
		&secureValue.GUID, &secureValue.Name, &secureValue.Namespace,
		&secureValue.Annotations, &secureValue.Labels,
		&secureValue.Created, &secureValue.CreatedBy,
		&secureValue.Updated, &secureValue.UpdatedBy,
		&secureValue.Description, &secureValue.Keeper, &secureValue.Decrypters, &secureValue.Ref,
		&secureValue.ExternalID, &secureValue.Active, &secureValue.Version,
		&secureValue.OwnerReferenceAPIVersion, &secureValue.OwnerReferenceKind, &secureValue.OwnerReferenceName, &secureValue.OwnerReferenceUID,
	); err != nil {
		return secureValueDB{}, fmt.Errorf("failed to scan secure value row: %w", err)
	}

	if err := res.Err(); err != nil {
		return secureValueDB{}, fmt.Errorf("read rows error: %w", err)
	}

	return secureValue, nil
}

func (s *secureValueMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (*secretv1beta1.SecureValue, error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.Read", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.Bool("isForUpdate", opts.ForUpdate),
	))
	defer span.End()

	secureValue, err := s.readActiveVersion(ctx, namespace, name, opts)
	if err != nil {
		return nil, err
	}

	secureValueKub, err := secureValue.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	s.metrics.SecureValueMetadataGetDuration.Observe(time.Since(start).Seconds())
	s.metrics.SecureValueMetadataGetCount.Inc()

	return secureValueKub, nil
}

func (s *secureValueMetadataStorage) List(ctx context.Context, namespace xkube.Namespace) (svList []secretv1beta1.SecureValue, error error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.List", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	defer func() {
		span.SetAttributes(attribute.Int("returnedList.count", len(svList)))
	}()

	req := listSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
	}

	q, err := sqltemplate.Execute(sqlSecureValueList, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlSecureValueList.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, q, req.GetArgs()...)
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
			&row.OwnerReferenceAPIVersion, &row.OwnerReferenceKind, &row.OwnerReferenceName, &row.OwnerReferenceUID,
		)

		if err != nil {
			return nil, fmt.Errorf("error reading secure value row: %w", err)
		}

		if !row.Active {
			return nil, fmt.Errorf("bug: read an inactive version: row=%+v", row)
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

	s.metrics.SecureValueMetadataListDuration.Observe(time.Since(start).Seconds())
	s.metrics.SecureValueMetadataListCount.Inc()

	return secureValues, nil
}

func (s *secureValueMetadataStorage) SetVersionToActive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error {
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.SetExternalID", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.Int64("version", version),
	))
	defer span.End()

	req := secureValueSetVersionToActive{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
		Version:     version,
	}

	q, err := sqltemplate.Execute(sqlSecureValueSetVersionToActive, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueSetVersionToActive.Name(), err)
	}

	res, err := s.db.ExecContext(ctx, q, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("setting secure value version to active: namespace=%+v name=%+v version=%+v %w", namespace, name, version, err)
	}

	// validate modified cound
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
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.SetExternalID", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.Int64("version", version),
	))
	defer span.End()

	req := secureValueSetVersionToInactive{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
		Version:     version,
	}

	q, err := sqltemplate.Execute(sqlSecureValueSetVersionToInactive, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueSetVersionToInactive.Name(), err)
	}

	res, err := s.db.ExecContext(ctx, q, req.GetArgs()...)
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

func (s *secureValueMetadataStorage) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, version int64, externalID contracts.ExternalID) error {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "SecureValueMetadataStorage.SetExternalID", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.String("externalID", externalID.String()),
		attribute.Int64("version", version),
	))
	defer span.End()

	req := updateExternalIdSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
		Version:     version,
		ExternalID:  externalID.String(),
	}

	q, err := sqltemplate.Execute(sqlSecureValueUpdateExternalId, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueUpdateExternalId.Name(), err)
	}

	res, err := s.db.ExecContext(ctx, q, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("setting secure value external id: namespace=%+v name=%+v externalID=%+v %w", namespace, name, externalID, err)
	}

	// validate modified cound
	modifiedCount, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting updated rows update external id secure value: %w", err)
	}
	if modifiedCount > 1 {
		return fmt.Errorf("secureValueMetadataStorage.SetExternalID: modified more than one secret, this is a bug, check the where condition: modifiedCount=%d", modifiedCount)
	}
	s.metrics.SecureValueSetExternalIDDuration.Observe(time.Since(start).Seconds())

	return nil
}
