package metadata

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-app-sdk/logging"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/metadata/metrics"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// keeperMetadataStorage is the actual implementation of the keeper metadata storage.
type keeperMetadataStorage struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
	tracer  trace.Tracer
	metrics *metrics.StorageMetrics
}

var _ contracts.KeeperMetadataStorage = (*keeperMetadataStorage)(nil)

func ProvideKeeperMetadataStorage(
	db contracts.Database,
	tracer trace.Tracer,
	reg prometheus.Registerer,
) (contracts.KeeperMetadataStorage, error) {
	return &keeperMetadataStorage{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		tracer:  tracer,
		metrics: metrics.NewStorageMetrics(reg),
	}, nil
}

func (s *keeperMetadataStorage) Create(ctx context.Context, keeper *secretv1beta1.Keeper, actorUID string) (_ *secretv1beta1.Keeper, createErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KeeperMetadataStorage.Create", trace.WithAttributes(
		attribute.String("name", keeper.GetName()),
		attribute.String("namespace", keeper.GetNamespace()),
		attribute.String("actorUID", actorUID),
	))
	defer span.End()

	defer func() {
		success := createErr == nil

		args := []any{
			"name", keeper.GetName(),
			"namespace", keeper.GetNamespace(),
			"actorUID", actorUID,
		}

		if !success {
			span.SetStatus(codes.Error, "KeeperMetadataStorage.Create failed")
			span.RecordError(createErr)
			args = append(args, "error", createErr)
		}

		logging.FromContext(ctx).Info("KeeperMetadataStorage.Create", args...)

		s.metrics.KeeperMetadataCreateDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	row, err := toKeeperCreateRow(keeper, actorUID)
	if err != nil {
		return nil, fmt.Errorf("failed to create row: %w", err)
	}

	req := createKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row:         row,
	}
	query, err := sqltemplate.Execute(sqlKeeperCreate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperCreate.Name(), err)
	}

	err = s.db.Transaction(ctx, func(ctx context.Context) error {
		// Validate before inserting that any `secureValues` referenced exist and do not reference other third-party keepers.
		if err := s.validateSecureValueReferences(ctx, keeper); err != nil {
			return err
		}

		result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
		if err != nil {
			if sql.IsRowAlreadyExistsError(err) {
				return fmt.Errorf("namespace=%s name=%s: %w", keeper.Namespace, keeper.Name, contracts.ErrKeeperAlreadyExists)
			}

			return fmt.Errorf("inserting row: %w", err)
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return fmt.Errorf("getting rows affected: %w", err)
		}

		if rowsAffected != 1 {
			return fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, keeper.Name, keeper.Namespace)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	createdKeeper, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return createdKeeper, nil
}

func (s *keeperMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (_ *secretv1beta1.Keeper, readErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KeeperMetadataStorage.Read", trace.WithAttributes(
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
		}

		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "KeeperMetadataStorage.Read failed")
			span.RecordError(readErr)
			args = append(args, "error", readErr)
		}

		logging.FromContext(ctx).Info("KeeperMetadataStorage.Read", args...)

		s.metrics.KeeperMetadataGetDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	keeperDB, err := s.read(ctx, namespace.String(), name, opts)
	if err != nil {
		return nil, err
	}

	keeper, err := keeperDB.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return keeper, nil
}

func (s *keeperMetadataStorage) read(ctx context.Context, namespace, name string, opts contracts.ReadOpts) (*keeperDB, error) {
	req := &readKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace,
		Name:        name,
		IsForUpdate: opts.ForUpdate,
	}

	query, err := sqltemplate.Execute(sqlKeeperRead, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperRead.Name(), err)
	}

	res, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("getting row for %s in namespace %s: %w", name, namespace, err)
	}
	defer func() { _ = res.Close() }()

	if !res.Next() {
		return nil, contracts.ErrKeeperNotFound
	}

	var keeper keeperDB
	err = res.Scan(
		&keeper.GUID, &keeper.Name, &keeper.Namespace, &keeper.Annotations, &keeper.Labels, &keeper.Created,
		&keeper.CreatedBy, &keeper.Updated, &keeper.UpdatedBy, &keeper.Description, &keeper.Type, &keeper.Payload,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to scan keeper row: %w", err)
	}
	if err := res.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return &keeper, nil
}

func (s *keeperMetadataStorage) Update(ctx context.Context, newKeeper *secretv1beta1.Keeper, actorUID string) (_ *secretv1beta1.Keeper, updateErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KeeperMetadataStorage.Update", trace.WithAttributes(
		attribute.String("name", newKeeper.GetName()),
		attribute.String("namespace", newKeeper.GetNamespace()),
		attribute.String("actorUID", actorUID),
	))
	defer span.End()

	defer func() {
		success := updateErr == nil
		args := []any{
			"name", newKeeper.GetName(),
			"namespace", newKeeper.GetNamespace(),
			"actorUID", actorUID,
		}

		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "KeeperMetadataStorage.Update failed")
			span.RecordError(updateErr)
			args = append(args, "error", updateErr)
		}

		logging.FromContext(ctx).Info("KeeperMetadataStorage.Update", args...)
		s.metrics.KeeperMetadataUpdateDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	var newRow *keeperDB

	err := s.db.Transaction(ctx, func(ctx context.Context) error {
		// Validate before updating that any `secureValues` referenced exists and does not reference other third-party keepers.
		if err := s.validateSecureValueReferences(ctx, newKeeper); err != nil {
			return err
		}

		// Read old value first.
		oldKeeperRow, err := s.read(ctx, newKeeper.Namespace, newKeeper.Name, contracts.ReadOpts{ForUpdate: true})
		if err != nil {
			return err
		}

		// Generate an update row model.
		var updateErr error
		newRow, updateErr = toKeeperUpdateRow(oldKeeperRow, newKeeper, actorUID)
		if updateErr != nil {
			return fmt.Errorf("failed to map into update row: %w", updateErr)
		}

		// Update query with new model.
		req := &updateKeeper{
			SQLTemplate: sqltemplate.New(s.dialect),
			Row:         newRow,
		}

		query, err := sqltemplate.Execute(sqlKeeperUpdate, req)
		if err != nil {
			return fmt.Errorf("execute template %q: %w", sqlKeeperUpdate.Name(), err)
		}

		result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
		if err != nil {
			return fmt.Errorf("updating row: %w", err)
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return fmt.Errorf("getting rows affected: %w", err)
		}

		if rowsAffected != 1 {
			return fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, newKeeper.Name, newKeeper.Namespace)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	keeper, err := newRow.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return keeper, nil
}

func (s *keeperMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) (delErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KeeperMetadataStorage.Delete", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	defer func() {
		success := delErr == nil

		args := []any{
			"name", name,
			"namespace", namespace.String(),
		}

		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "KeeperMetadataStorage.Delete failed")
			span.RecordError(delErr)
			args = append(args, "error", delErr)
		}

		logging.FromContext(ctx).Info("KeeperMetadataStorage.Delete", args...)

		s.metrics.KeeperMetadataDeleteDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	req := deleteKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
	}

	query, err := sqltemplate.Execute(sqlKeeperDelete, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlKeeperDelete.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("deleting row: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return contracts.ErrKeeperNotFound
	} else if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, name, namespace)
	}

	return nil
}

func (s *keeperMetadataStorage) List(ctx context.Context, namespace xkube.Namespace) (keeperList []secretv1beta1.Keeper, err error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KeeperMetadataStorage.List", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	defer func() {
		span.SetAttributes(attribute.Int("returnedList.count", len(keeperList)))
		success := err == nil

		args := []any{
			"namespace", namespace.String(),
			"success", success,
		}

		if !success {
			span.SetStatus(codes.Error, "KeeperMetadataStorage.List failed")
			span.RecordError(err)
			args = append(args, "error", err)
		}

		logging.FromContext(ctx).Info("KeeperMetadataStorage.List", args...)

		s.metrics.KeeperMetadataListDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	req := listKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
	}

	query, err := sqltemplate.Execute(sqlKeeperList, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperList.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("listing keepers %q: %w", sqlKeeperList.Name(), err)
	}
	defer func() { _ = rows.Close() }()

	keepers := make([]secretv1beta1.Keeper, 0)

	for rows.Next() {
		var row keeperDB
		err = rows.Scan(
			&row.GUID, &row.Name, &row.Namespace, &row.Annotations, &row.Labels, &row.Created,
			&row.CreatedBy, &row.Updated, &row.UpdatedBy, &row.Description, &row.Type, &row.Payload,
		)
		if err != nil {
			return nil, fmt.Errorf("error reading keeper row: %w", err)
		}

		keeper, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
		}

		keepers = append(keepers, *keeper)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return keepers, nil
}

// validateSecureValueReferences checks that all secure values referenced by the keeper exist and are not referenced by other third-party keepers.
// It is used by other methods inside a transaction.
func (s *keeperMetadataStorage) validateSecureValueReferences(ctx context.Context, keeper *secretv1beta1.Keeper) (err error) {
	ctx, span := s.tracer.Start(ctx, "KeeperMetadataStorage.ValidateSecureValueReferences", trace.WithAttributes(
		attribute.String("name", keeper.GetName()),
		attribute.String("namespace", keeper.GetNamespace()),
	))
	defer span.End()

	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, "failed to validate secure value references")
			span.RecordError(err)
		}
	}()

	usedSecureValues := extractSecureValues(keeper)

	// No secure values are referenced, return early.
	if len(usedSecureValues) == 0 {
		return nil
	}

	// SQL templates do not support maps.
	usedSecureValuesList := make([]string, 0, len(usedSecureValues))
	for sv := range usedSecureValues {
		usedSecureValuesList = append(usedSecureValuesList, sv)
	}

	reqSecureValue := listByNameSecureValue{
		SQLTemplate:      sqltemplate.New(s.dialect),
		Namespace:        keeper.Namespace,
		UsedSecureValues: usedSecureValuesList,
	}

	querySecureValueList, err := sqltemplate.Execute(sqlSecureValueListByName, reqSecureValue)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueListByName.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, querySecureValueList, reqSecureValue.GetArgs()...)
	if err != nil {
		return fmt.Errorf("executing query: %w", err)
	}
	defer func() { _ = rows.Close() }()

	// DTO for `sqlSecureValueListByName` query result, only what we need.
	type listByNameResult struct {
		Name   string
		Keeper *string
	}

	secureValueRows := make([]listByNameResult, 0)
	for rows.Next() {
		var row listByNameResult
		if err := rows.Scan(&row.Name, &row.Keeper); err != nil {
			return fmt.Errorf("error reading secret value row: %w", err)
		}

		secureValueRows = append(secureValueRows, row)
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("secret value rows error: %w", err)
	}

	// If not all secure values being referenced exist, return an error with the missing ones.
	if len(secureValueRows) != len(usedSecureValues) {
		// We are guaranteed that the returned `secureValueRows` are a subset of `usedSecureValues`,
		// so we don't need to check the other way around.
		missing := make(map[string]struct{}, len(usedSecureValues))
		for sv := range usedSecureValues {
			missing[sv] = struct{}{}
		}

		for _, svRow := range secureValueRows {
			delete(missing, svRow.Name)
		}

		return contracts.NewErrKeeperInvalidSecureValues(missing)
	}

	// If all secure values exist, we need to guarantee that the third-party keeper is not referencing another third-party,
	// it must reference only the system keeper (when keeper=null) to keep the dependency tree flat (n=1).
	keeperNames := make([]string, 0, len(secureValueRows))
	keeperSecureValues := make(map[string][]string, 0)

	for _, svRow := range secureValueRows {
		// Using the system keeper (null).
		if svRow.Keeper == nil {
			continue
		}

		keeperNames = append(keeperNames, *svRow.Keeper)
		keeperSecureValues[*svRow.Keeper] = append(keeperSecureValues[*svRow.Keeper], svRow.Name)
	}

	// We didn't find any secure values that reference third-party keepers.
	if len(keeperNames) == 0 {
		return nil
	}

	reqKeeper := listByNameKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   keeper.Namespace,
		KeeperNames: keeperNames,
	}

	qKeeper, err := sqltemplate.Execute(sqlKeeperListByName, reqKeeper)
	if err != nil {
		return fmt.Errorf("template %q: %w", sqlKeeperListByName.Name(), err)
	}

	keepersRows, err := s.db.QueryContext(ctx, qKeeper, reqKeeper.GetArgs()...)
	if err != nil {
		return fmt.Errorf("listing by name %q: %w", qKeeper, err)
	}
	defer func() { _ = keepersRows.Close() }()

	thirdPartyKeepers := make([]string, 0)
	for keepersRows.Next() {
		var name string
		if err := keepersRows.Scan(&name); err != nil {
			return fmt.Errorf("error reading keeper row: %w", err)
		}

		thirdPartyKeepers = append(thirdPartyKeepers, name)
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("third party keeper rows error: %w", err)
	}

	// Found secureValueNames that are referenced by third-party keepers.
	if len(thirdPartyKeepers) > 0 {
		invalidSecureValues := make(map[string]string, 0)

		for _, keeperName := range thirdPartyKeepers {
			for _, svName := range keeperSecureValues[keeperName] {
				invalidSecureValues[svName] = keeperName
			}
		}

		return contracts.NewErrKeeperInvalidSecureValuesReference(invalidSecureValues)
	}

	return nil
}

func (s *keeperMetadataStorage) GetKeeperConfig(ctx context.Context, namespace string, name *string, opts contracts.ReadOpts) (_ secretv1beta1.KeeperConfig, getErr error) {
	ctx, span := s.tracer.Start(ctx, "KeeperMetadataStorage.GetKeeperConfig", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.Bool("isForUpdate", opts.ForUpdate),
	))
	start := time.Now()
	defer span.End()

	defer func() {
		success := getErr == nil

		args := []any{
			"namespace", namespace,
			"isForUpdate", strconv.FormatBool(opts.ForUpdate),
		}

		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "KeeperMetadataStorage.GetKeeperConfig failed")
			span.RecordError(getErr)
			args = append(args, "error", getErr)
		}

		logging.FromContext(ctx).Info("KeeperMetadataStorage.GetKeeperConfig", args...)

		s.metrics.KeeperMetadataGetKeeperConfigDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	// Check if keeper is the systemwide one.
	if name == nil {
		return &secretv1beta1.SystemKeeperConfig{}, nil
	}

	span.SetAttributes(attribute.String("name", *name))

	// Load keeper config from metadata store, or TODO: keeper cache.
	kp, err := s.read(ctx, namespace, *name, opts)
	if err != nil {
		return nil, err
	}

	keeperConfig := toProvider(secretv1beta1.KeeperType(kp.Type), kp.Payload)

	// TODO: this would be a good place to check if credentials are secure values and load them.
	return keeperConfig, nil
}
