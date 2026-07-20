package metadata

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
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

	usedSecureValues := slices.Collect(maps.Keys(extractSecureValues(keeper)))

	req := createKeeper{
		SQLTemplate:      sqltemplate.New(s.dialect),
		Row:              row,
		UsedSecureValues: usedSecureValues,
		SystemKeeperName: contracts.SystemKeeperName,
	}
	query, err := sqltemplate.Execute(sqlKeeperCreate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperCreate.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		if sql.IsRowAlreadyExistsError(err) {
			return nil, fmt.Errorf("namespace=%s name=%s: %w", keeper.Namespace, keeper.Name, contracts.ErrKeeperAlreadyExists)
		}

		return nil, fmt.Errorf("inserting row: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("getting rows affected: %w", err)
	}

	if rowsAffected != 1 {
		// In case nothing was inserted, and if there are used secure values,
		// this must have failed the check where a secure value is referencing a keeper.
		// We can now test which one is causing the insert to error.
		if rowsAffected == 0 && len(usedSecureValues) > 0 {
			if validateErr := s.validateSecureValueReferences(ctx, keeper); validateErr != nil {
				return nil, validateErr
			}
		}

		return nil, fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, keeper.Name, keeper.Namespace)
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
		return nil, fmt.Errorf("keeper=%s: %w", name, contracts.ErrKeeperNotFound)
	}

	var keeper keeperDB
	err = res.Scan(
		&keeper.GUID, &keeper.Name, &keeper.Namespace, &keeper.Annotations, &keeper.Labels, &keeper.Created,
		&keeper.CreatedBy, &keeper.Updated, &keeper.UpdatedBy, &keeper.Description, &keeper.Type, &keeper.Payload,
		&keeper.Active,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to scan keeper row: %w", err)
	}
	if err := res.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}
	if keeper.Namespace != namespace || keeper.Name != name {
		return nil, fmt.Errorf("bug: expected to find keeper namespace=%+v name=%+v but got keeper namespace=%+v name%+v",
			namespace, name, keeper.Namespace, keeper.Name)
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

	// Read old value first.
	oldKeeperRow, err := s.read(ctx, newKeeper.Namespace, newKeeper.Name, contracts.ReadOpts{})
	if err != nil {
		return nil, err
	}

	// Generate an update row model.
	newRow, err := toKeeperUpdateRow(oldKeeperRow, newKeeper, actorUID)
	if err != nil {
		return nil, fmt.Errorf("failed to map into update row: %w", err)
	}

	usedSecureValues := slices.Collect(maps.Keys(extractSecureValues(newKeeper)))

	req := &updateKeeper{
		SQLTemplate:      sqltemplate.New(s.dialect),
		Row:              newRow,
		UsedSecureValues: usedSecureValues,
		SystemKeeperName: contracts.SystemKeeperName,
	}

	query, err := sqltemplate.Execute(sqlKeeperUpdate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperUpdate.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("updating row: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("getting rows affected: %w", err)
	}

	if rowsAffected != 1 {
		// In case nothing was inserted, and if there are used secure values,
		// this must have failed the check where a secure value is referencing a keeper.
		// We can now test which one is causing the insert to error.
		if rowsAffected == 0 && len(usedSecureValues) > 0 {
			if validateErr := s.validateSecureValueReferences(ctx, newKeeper); validateErr != nil {
				return nil, validateErr
			}
		}

		return nil, contracts.ErrKeeperNotFound
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
			&row.Active,
		)
		if err != nil {
			return nil, fmt.Errorf("error reading keeper row: %w", err)
		}

		if row.Namespace != namespace.String() {
			return nil, fmt.Errorf("bug: expected to list keepers for namespace %+v but got one from namespace %+v", namespace, row.Namespace)
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

	usedSecureValues := slices.Collect(maps.Keys(extractSecureValues(keeper)))

	// No secure values are referenced, return early.
	if len(usedSecureValues) == 0 {
		return nil
	}

	reqSecureValue := listByNameSecureValue{
		SQLTemplate:      sqltemplate.New(s.dialect),
		Namespace:        keeper.Namespace,
		UsedSecureValues: usedSecureValues,
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
		for _, sv := range usedSecureValues {
			missing[sv] = struct{}{}
		}

		for _, svRow := range secureValueRows {
			delete(missing, svRow.Name)
		}

		return contracts.NewErrKeeperInvalidSecureValues(missing)
	}

	// Every referenced secure value must use the system keeper to keep the dependency tree flat (n=1).
	invalidSecureValues := make(map[string]string, 0)
	for _, svRow := range secureValueRows {
		keeperName := ""
		if svRow.Keeper != nil {
			keeperName = *svRow.Keeper
		}
		if keeperName != contracts.SystemKeeperName {
			invalidSecureValues[svRow.Name] = keeperName
		}
	}

	if len(invalidSecureValues) > 0 {
		return contracts.NewErrKeeperInvalidSecureValuesReference(invalidSecureValues)
	}

	return nil
}

func (s *keeperMetadataStorage) GetKeeperConfig(ctx context.Context, namespace string, name string, opts contracts.ReadOpts) (_ secretv1beta1.KeeperConfig, getErr error) {
	ctx, span := s.tracer.Start(ctx, "KeeperMetadataStorage.GetKeeperConfig", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
		attribute.Bool("isForUpdate", opts.ForUpdate),
	))
	start := time.Now()
	defer span.End()

	defer func() {
		success := getErr == nil

		args := []any{
			"namespace", namespace,
			"name", name,
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
	if name == contracts.SystemKeeperName {
		return secretv1beta1.NewNamedKeeperConfig(contracts.SystemKeeperName, &secretv1beta1.SystemKeeperConfig{}), nil
	}

	// Load keeper config from metadata store, or TODO: keeper cache.
	kp, err := s.read(ctx, namespace, name, opts)
	if err != nil {
		return nil, err
	}

	keeperConfig := parseKeeperConfigJson(kp.Name, secretv1beta1.KeeperType(kp.Type), kp.Payload)

	// TODO: this would be a good place to check if credentials are secure values and load them.
	return keeperConfig, nil
}

func (s *keeperMetadataStorage) SetAsActive(ctx context.Context, namespace xkube.Namespace, name string) error {
	req := setKeeperAsActive{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
	}

	query, err := sqltemplate.Execute(sqlKeeperSetAsActive, req)
	if err != nil {
		return fmt.Errorf("template %q: %w", sqlKeeperSetAsActive.Name(), err)
	}

	_, err = s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("setting keeper as active %q: %w", query, err)
	}

	return nil
}

func (s *keeperMetadataStorage) GetActiveKeeper(ctx context.Context, namespace string) (keeper *secretv1beta1.Keeper, readErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KeeperMetadataStorage.GetActiveKeeper", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()

	defer func() {
		success := readErr == nil

		args := []any{
			"namespace", namespace,
		}

		args = append(args, "success", success)
		if !success {
			span.SetStatus(codes.Error, "KeeperMetadataStorage.GetActiveKeeper failed")
			span.RecordError(readErr)
			args = append(args, "error", readErr)
		}

		logging.FromContext(ctx).Info("KeeperMetadataStorage.GetActiveKeeper", args...)

		s.metrics.KeeperMetadataGetDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	req := &readActiveKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace,
	}

	query, err := sqltemplate.Execute(sqlKeeperReadActive, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperReadActive.Name(), err)
	}

	res, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("executing query to fetch active keeper in namespace %s: %w", namespace, err)
	}
	defer func() { _ = res.Close() }()

	if !res.Next() {
		return nil, contracts.ErrKeeperNotFound
	}

	var keeperDB keeperDB
	err = res.Scan(
		&keeperDB.GUID, &keeperDB.Name, &keeperDB.Namespace, &keeperDB.Annotations, &keeperDB.Labels, &keeperDB.Created,
		&keeperDB.CreatedBy, &keeperDB.Updated, &keeperDB.UpdatedBy, &keeperDB.Description, &keeperDB.Type, &keeperDB.Payload,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to scan keeper row: %w", err)
	}
	if err := res.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	keeper, readErr = keeperDB.toKubernetes()
	if readErr != nil {
		return keeper, fmt.Errorf("converting from keeperDB to kubernetes struct: %w", err)
	}

	if keeperDB.Namespace != namespace {
		return nil, fmt.Errorf("bug: expected to find keeper to namespace %+v but got one for namespace %+v", namespace, keeperDB.Namespace)
	}

	return keeper, nil
}

func (s *keeperMetadataStorage) GetActiveKeeperConfig(ctx context.Context, namespace string) (string, secretv1beta1.KeeperConfig, error) {
	keeper, err := s.GetActiveKeeper(ctx, namespace)
	if err != nil {
		// When there are not active keepers, default to the system keeper
		if errors.Is(err, contracts.ErrKeeperNotFound) {
			return contracts.SystemKeeperName, secretv1beta1.NewNamedKeeperConfig(contracts.SystemKeeperName, &secretv1beta1.SystemKeeperConfig{}), nil
		}
		return "", nil, fmt.Errorf("fetching active keeper from db: %w", err)
	}

	return keeper.Name, getKeeperConfig(keeper), nil
}
