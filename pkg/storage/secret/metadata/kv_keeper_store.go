package metadata

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	kvSectionKeepers = "secret/keepers"

	// Every kind of key in the section has its own prefix so prefix listings never mix them up
	keeperKeyPrefix          = "keepers/"
	keeperCasKeyPrefix       = "cas/keepers/"
	activeKeeperKeyPrefix    = "active/keepers/"
	activeKeeperCasKeyPrefix = "cas/active/keepers/"
)

type kvKeeperMetadataStorage struct {
	kv        resource.KV
	snowflake contracts.Snowflake
	tracer    trace.Tracer
	metrics   *metrics.StorageMetrics
}

var _ contracts.KeeperMetadataStorage = (*kvKeeperMetadataStorage)(nil)

func NewKVKeeperMetadataStorage(kv resource.KV, snowflake contracts.Snowflake, tracer trace.Tracer, reg prometheus.Registerer) contracts.KeeperMetadataStorage {
	return &kvKeeperMetadataStorage{
		kv:        kv,
		snowflake: snowflake,
		tracer:    tracer,
		metrics:   metrics.NewStorageMetrics(reg),
	}
}

// keeperKV is the value stored at the keeper key.
// ResourceVersion is unique per write so a keeper cas key is never reused.
type keeperKV struct {
	Keeper          keeperDB `json:"keeper"`
	ResourceVersion int64    `json:"resource_version"`
}

// activeKeeperKV is the value stored at the active keeper key.
// It has a copy of the active keeper so the active keeper can be read with a single read.
type activeKeeperKV struct {
	// Nil when the system keeper is active
	Keeper          *keeperKV `json:"keeper,omitempty"`
	ResourceVersion int64     `json:"resource_version"`
}

func (s *kvKeeperMetadataStorage) Create(ctx context.Context, keeper *secretv1beta1.Keeper, actorUID string) (_ *secretv1beta1.Keeper, createErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KVKeeperMetadataStorage.Create", trace.WithAttributes(
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
			span.SetStatus(codes.Error, "KVKeeperMetadataStorage.Create failed")
			span.RecordError(createErr)
			args = append(args, "error", createErr)
		}

		logging.FromContext(ctx).Info("KVKeeperMetadataStorage.Create", args...)

		s.metrics.KeeperMetadataCreateDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	row, err := toKeeperCreateRow(keeper, actorUID)
	if err != nil {
		return nil, fmt.Errorf("failed to create row: %w", err)
	}

	value := keeperKV{Keeper: *row, ResourceVersion: s.snowflake.Generate()}
	buffer, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("json marshaling keeper: %w", err)
	}

	// The creates fail if the keeper already exists
	if err := s.kv.Batch(ctx, kvSectionKeepers, []kv.BatchOp{
		{
			Mode:  kv.BatchOpCreate,
			Key:   makeKeeperKey(row.Namespace, row.Name),
			Value: buffer,
		},
		{
			Mode:  kv.BatchOpCreate,
			Key:   makeKeeperCasKey(row.Namespace, row.Name, value.ResourceVersion),
			Value: casKeyPlaceholder,
		},
	}); err != nil {
		if errors.Is(err, kv.ErrKeyAlreadyExists) {
			return nil, fmt.Errorf("namespace=%s name=%s: %w", keeper.Namespace, keeper.Name, contracts.ErrKeeperAlreadyExists)
		}
		return nil, fmt.Errorf("writing keeper to kv store: %w", err)
	}

	createdKeeper, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return createdKeeper, nil
}

func (s *kvKeeperMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (_ *secretv1beta1.Keeper, readErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KVKeeperMetadataStorage.Read", trace.WithAttributes(
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
			span.SetStatus(codes.Error, "KVKeeperMetadataStorage.Read failed")
			span.RecordError(readErr)
			args = append(args, "error", readErr)
		}

		logging.FromContext(ctx).Info("KVKeeperMetadataStorage.Read", args...)

		s.metrics.KeeperMetadataGetDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	value, err := s.read(ctx, namespace.String(), name)
	if err != nil {
		return nil, err
	}

	keeper, err := value.Keeper.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return keeper, nil
}

func (s *kvKeeperMetadataStorage) read(ctx context.Context, namespace, name string) (*keeperKV, error) {
	reader, err := s.kv.Get(ctx, kvSectionKeepers, makeKeeperKey(namespace, name))
	if err != nil {
		if errors.Is(err, resource.ErrNotFound) {
			return nil, fmt.Errorf("keeper=%s: %w", name, contracts.ErrKeeperNotFound)
		}
		return nil, fmt.Errorf("fetching keeper: %w", err)
	}

	value, err := parse[keeperKV](reader)
	if err != nil {
		return nil, fmt.Errorf("parsing keeper: %w", err)
	}

	return &value, nil
}

func (s *kvKeeperMetadataStorage) Update(ctx context.Context, newKeeper *secretv1beta1.Keeper, actorUID string) (_ *secretv1beta1.Keeper, updateErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KVKeeperMetadataStorage.Update", trace.WithAttributes(
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
			"success", success,
		}

		if !success {
			span.SetStatus(codes.Error, "KVKeeperMetadataStorage.Update failed")
			span.RecordError(updateErr)
			args = append(args, "error", updateErr)
		}

		logging.FromContext(ctx).Info("KVKeeperMetadataStorage.Update", args...)
		s.metrics.KeeperMetadataUpdateDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	ns := newKeeper.Namespace
	name := newKeeper.Name

	observedKeeper, err := s.read(ctx, ns, name)
	if err != nil {
		return nil, err
	}

	newRow, err := toKeeperUpdateRow(&observedKeeper.Keeper, newKeeper, actorUID)
	if err != nil {
		return nil, fmt.Errorf("failed to map into update row: %w", err)
	}
	newRow.Active = observedKeeper.Keeper.Active

	newKeeperValue := keeperKV{Keeper: *newRow, ResourceVersion: s.snowflake.Generate()}
	newKeeperJson, err := json.Marshal(newKeeperValue)
	if err != nil {
		return nil, fmt.Errorf("json marshaling keeper: %w", err)
	}

	ops := []kv.BatchOp{
		{
			Mode:  kv.BatchOpUpdate,
			Key:   makeKeeperKey(ns, name),
			Value: newKeeperJson,
		},
		// CAS on the observed keeper. Update to make sure it still exists
		{
			Mode:  kv.BatchOpUpdate,
			Key:   makeKeeperCasKey(ns, name, observedKeeper.ResourceVersion),
			Value: casKeyPlaceholder,
		},
		// Delete old version
		{
			Mode: kv.BatchOpDelete,
			Key:  makeKeeperCasKey(ns, name, observedKeeper.ResourceVersion),
		},
		// Create new version
		{
			Mode:  kv.BatchOpCreate,
			Key:   makeKeeperCasKey(ns, name, newKeeperValue.ResourceVersion),
			Value: casKeyPlaceholder,
		},
	}

	// The keeper is active, keep the copy in the active keeper key up to date
	if observedKeeper.Keeper.Active {
		observedActiveKeeper, err := s.getActiveKeeper(ctx, ns)
		if err != nil {
			return nil, err
		}
		if observedActiveKeeper == nil {
			return nil, fmt.Errorf("bug: keeper namespace=%s name=%s is active but the active keeper key doesn't exist", ns, name)
		}

		newActiveKeeperValue := activeKeeperKV{Keeper: &newKeeperValue, ResourceVersion: s.snowflake.Generate()}
		newActiveKeeperJson, err := json.Marshal(newActiveKeeperValue)
		if err != nil {
			return nil, fmt.Errorf("json marshaling active keeper: %w", err)
		}

		ops = append(ops,
			kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   makeActiveKeeperKey(ns),
				Value: newActiveKeeperJson,
			},
			// CAS on the observed active keeper. Update to make sure it still exists
			kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   makeActiveKeeperCasKey(ns, observedActiveKeeper.ResourceVersion),
				Value: casKeyPlaceholder,
			},
			// Delete old version
			kv.BatchOp{
				Mode: kv.BatchOpDelete,
				Key:  makeActiveKeeperCasKey(ns, observedActiveKeeper.ResourceVersion),
			},
			// Create new version
			kv.BatchOp{
				Mode:  kv.BatchOpCreate,
				Key:   makeActiveKeeperCasKey(ns, newActiveKeeperValue.ResourceVersion),
				Value: casKeyPlaceholder,
			},
		)
	}

	if err := s.kv.Batch(ctx, kvSectionKeepers, ops); err != nil {
		if isKeeperNotFoundErr(err, ns, name) {
			return nil, contracts.ErrKeeperNotFound
		}
		if isKeyNotFoundBatchErr(err) {
			return nil, keeperConflictErr(ns, name)
		}
		return nil, fmt.Errorf("updating keeper in kv store: %w", err)
	}

	keeper, err := newRow.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return keeper, nil
}

func (s *kvKeeperMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) (delErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KVKeeperMetadataStorage.Delete", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	defer func() {
		success := delErr == nil

		args := []any{
			"name", name,
			"namespace", namespace.String(),
			"success", success,
		}

		if !success {
			span.SetStatus(codes.Error, "KVKeeperMetadataStorage.Delete failed")
			span.RecordError(delErr)
			args = append(args, "error", delErr)
		}

		logging.FromContext(ctx).Info("KVKeeperMetadataStorage.Delete", args...)

		s.metrics.KeeperMetadataDeleteDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	ns := namespace.String()

	observedKeeper, err := s.read(ctx, ns, name)
	if err != nil {
		return err
	}

	observedKeeperJson, err := json.Marshal(observedKeeper)
	if err != nil {
		return fmt.Errorf("json marshaling keeper: %w", err)
	}

	ops := []kv.BatchOp{
		// No-op update that only checks the keeper exists, so a deleted keeper fails here instead of on the cas key
		{
			Mode:  kv.BatchOpUpdate,
			Key:   makeKeeperKey(ns, name),
			Value: observedKeeperJson,
		},
		// CAS on the observed keeper. Update to make sure it still exists
		{
			Mode:  kv.BatchOpUpdate,
			Key:   makeKeeperCasKey(ns, name, observedKeeper.ResourceVersion),
			Value: casKeyPlaceholder,
		},
		{
			Mode: kv.BatchOpDelete,
			Key:  makeKeeperCasKey(ns, name, observedKeeper.ResourceVersion),
		},
		{
			Mode: kv.BatchOpDelete,
			Key:  makeKeeperKey(ns, name),
		},
	}

	// A deleted keeper is never active, the system keeper becomes the active one
	if observedKeeper.Keeper.Active {
		observedActiveKeeper, err := s.getActiveKeeper(ctx, ns)
		if err != nil {
			return err
		}
		if observedActiveKeeper == nil {
			return fmt.Errorf("bug: keeper namespace=%s name=%s is active but the active keeper key doesn't exist", ns, name)
		}

		newActiveKeeperValue := activeKeeperKV{ResourceVersion: s.snowflake.Generate()}
		newActiveKeeperJson, err := json.Marshal(newActiveKeeperValue)
		if err != nil {
			return fmt.Errorf("json marshaling active keeper: %w", err)
		}

		ops = append(ops,
			kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   makeActiveKeeperKey(ns),
				Value: newActiveKeeperJson,
			},
			// CAS on the observed active keeper. Update to make sure it still exists
			kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   makeActiveKeeperCasKey(ns, observedActiveKeeper.ResourceVersion),
				Value: casKeyPlaceholder,
			},
			// Delete old version
			kv.BatchOp{
				Mode: kv.BatchOpDelete,
				Key:  makeActiveKeeperCasKey(ns, observedActiveKeeper.ResourceVersion),
			},
			// Create new version
			kv.BatchOp{
				Mode:  kv.BatchOpCreate,
				Key:   makeActiveKeeperCasKey(ns, newActiveKeeperValue.ResourceVersion),
				Value: casKeyPlaceholder,
			},
		)
	}

	if err := s.kv.Batch(ctx, kvSectionKeepers, ops); err != nil {
		if isKeeperNotFoundErr(err, ns, name) {
			return contracts.ErrKeeperNotFound
		}
		if isKeyNotFoundBatchErr(err) {
			return keeperConflictErr(ns, name)
		}
		return fmt.Errorf("deleting keeper from kv store: %w", err)
	}

	return nil
}

func (s *kvKeeperMetadataStorage) List(ctx context.Context, namespace xkube.Namespace) (keeperList []secretv1beta1.Keeper, err error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KVKeeperMetadataStorage.List", trace.WithAttributes(
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
			span.SetStatus(codes.Error, "KVKeeperMetadataStorage.List failed")
			span.RecordError(err)
			args = append(args, "error", err)
		}

		logging.FromContext(ctx).Info("KVKeeperMetadataStorage.List", args...)

		s.metrics.KeeperMetadataListDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	prefix := makeKeeperNamespacePrefix(namespace.String())
	keys := make([]string, 0)

	// TODO: unbounded number of entries
	for key, err := range s.kv.Keys(ctx, kvSectionKeepers, resource.ListOptions{
		StartKey: prefix,
		EndKey:   resource.PrefixRangeEnd(prefix),
	}) {
		if err != nil {
			return nil, fmt.Errorf("listing keeper keys in the kv store: %w", err)
		}
		keys = append(keys, key)
	}

	rows := make([]keeperDB, 0, len(keys))
	for keyValue, err := range s.kv.BatchGet(ctx, kvSectionKeepers, keys) {
		if err != nil {
			return nil, fmt.Errorf("fetching keepers from kv store: %w", err)
		}

		value, err := parse[keeperKV](keyValue.Value)
		if err != nil {
			return nil, fmt.Errorf("parsing keeper: %w", err)
		}

		rows = append(rows, value.Keeper)
	}

	// Same order as the sql store
	slices.SortStableFunc(rows, func(a, b keeperDB) int {
		return cmp.Compare(b.Updated, a.Updated)
	})

	keepers := make([]secretv1beta1.Keeper, 0, len(rows))
	for _, row := range rows {
		keeper, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
		}
		keepers = append(keepers, *keeper)
	}

	return keepers, nil
}

func (s *kvKeeperMetadataStorage) GetKeeperConfig(ctx context.Context, namespace string, name string, opts contracts.ReadOpts) (_ secretv1beta1.KeeperConfig, getErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "KVKeeperMetadataStorage.GetKeeperConfig", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
		attribute.Bool("isForUpdate", opts.ForUpdate),
	))
	defer span.End()

	defer func() {
		success := getErr == nil

		args := []any{
			"namespace", namespace,
			"name", name,
			"isForUpdate", strconv.FormatBool(opts.ForUpdate),
			"success", success,
		}

		if !success {
			span.SetStatus(codes.Error, "KVKeeperMetadataStorage.GetKeeperConfig failed")
			span.RecordError(getErr)
			args = append(args, "error", getErr)
		}

		logging.FromContext(ctx).Info("KVKeeperMetadataStorage.GetKeeperConfig", args...)

		s.metrics.KeeperMetadataGetKeeperConfigDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	// The system keeper is not stored
	if name == contracts.SystemKeeperName {
		return secretv1beta1.NewNamedKeeperConfig(contracts.SystemKeeperName, &secretv1beta1.SystemKeeperConfig{}), nil
	}

	value, err := s.read(ctx, namespace, name)
	if err != nil {
		return nil, err
	}

	return parseKeeperConfigJson(value.Keeper.Name, secretv1beta1.KeeperType(value.Keeper.Type), value.Keeper.Payload), nil
}

func (s *kvKeeperMetadataStorage) SetAsActive(ctx context.Context, namespace xkube.Namespace, name string) (err error) {
	ctx, span := s.tracer.Start(ctx, "KVKeeperMetadataStorage.SetAsActive", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
	))
	defer span.End()

	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, "KVKeeperMetadataStorage.SetAsActive failed")
			span.RecordError(err)
		}
	}()

	ns := namespace.String()

	observedActiveKeeper, err := s.getActiveKeeper(ctx, ns)
	if err != nil {
		return err
	}

	// The keeper is already active
	if observedActiveKeeper != nil && observedActiveKeeper.Keeper != nil && observedActiveKeeper.Keeper.Keeper.Name == name {
		return nil
	}

	ops := make([]kv.BatchOp, 0)

	// Like the sql store, setting a keeper that doesn't exist as active makes the system keeper the active one
	var newActiveKeeper *keeperKV
	if name != contracts.SystemKeeperName {
		observedKeeper, err := s.read(ctx, ns, name)
		if err != nil && !errors.Is(err, contracts.ErrKeeperNotFound) {
			return err
		}

		if observedKeeper != nil {
			newActiveKeeper = &keeperKV{Keeper: observedKeeper.Keeper, ResourceVersion: s.snowflake.Generate()}
			newActiveKeeper.Keeper.Active = true

			newActiveKeeperJson, err := json.Marshal(newActiveKeeper)
			if err != nil {
				return fmt.Errorf("json marshaling keeper: %w", err)
			}

			ops = append(ops,
				// Mark the keeper as active
				kv.BatchOp{
					Mode:  kv.BatchOpUpdate,
					Key:   makeKeeperKey(ns, name),
					Value: newActiveKeeperJson,
				},
				// CAS on the observed keeper. Update to make sure it still exists
				kv.BatchOp{
					Mode:  kv.BatchOpUpdate,
					Key:   makeKeeperCasKey(ns, name, observedKeeper.ResourceVersion),
					Value: casKeyPlaceholder,
				},
				// Delete old version
				kv.BatchOp{
					Mode: kv.BatchOpDelete,
					Key:  makeKeeperCasKey(ns, name, observedKeeper.ResourceVersion),
				},
				// Create new version
				kv.BatchOp{
					Mode:  kv.BatchOpCreate,
					Key:   makeKeeperCasKey(ns, name, newActiveKeeper.ResourceVersion),
					Value: casKeyPlaceholder,
				},
			)
		}
	}

	// The copy in the active keeper key is up to date because the active cas key is checked below
	if observedActiveKeeper != nil && observedActiveKeeper.Keeper != nil {
		oldActiveKeeper := observedActiveKeeper.Keeper
		newInactiveKeeper := keeperKV{Keeper: oldActiveKeeper.Keeper, ResourceVersion: s.snowflake.Generate()}
		newInactiveKeeper.Keeper.Active = false

		newInactiveKeeperJson, err := json.Marshal(newInactiveKeeper)
		if err != nil {
			return fmt.Errorf("json marshaling keeper: %w", err)
		}

		ops = append(ops,
			// Mark the previously active keeper as inactive
			kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   makeKeeperKey(ns, oldActiveKeeper.Keeper.Name),
				Value: newInactiveKeeperJson,
			},
			// CAS on the previously active keeper. Update to make sure it still exists
			kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   makeKeeperCasKey(ns, oldActiveKeeper.Keeper.Name, oldActiveKeeper.ResourceVersion),
				Value: casKeyPlaceholder,
			},
			// Delete old version
			kv.BatchOp{
				Mode: kv.BatchOpDelete,
				Key:  makeKeeperCasKey(ns, oldActiveKeeper.Keeper.Name, oldActiveKeeper.ResourceVersion),
			},
			// Create new version
			kv.BatchOp{
				Mode:  kv.BatchOpCreate,
				Key:   makeKeeperCasKey(ns, oldActiveKeeper.Keeper.Name, newInactiveKeeper.ResourceVersion),
				Value: casKeyPlaceholder,
			},
		)
	}

	newActiveKeeperValue := activeKeeperKV{Keeper: newActiveKeeper, ResourceVersion: s.snowflake.Generate()}
	newActiveKeeperValueJson, err := json.Marshal(newActiveKeeperValue)
	if err != nil {
		return fmt.Errorf("json marshaling active keeper: %w", err)
	}

	if observedActiveKeeper == nil {
		ops = append(ops,
			// No keeper was ever active. The creates fail if another keeper was activated in the meantime.
			kv.BatchOp{
				Mode:  kv.BatchOpCreate,
				Key:   makeActiveKeeperKey(ns),
				Value: newActiveKeeperValueJson,
			},
			kv.BatchOp{
				Mode:  kv.BatchOpCreate,
				Key:   makeActiveKeeperCasKey(ns, newActiveKeeperValue.ResourceVersion),
				Value: casKeyPlaceholder,
			},
		)
	} else {
		ops = append(ops,
			kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   makeActiveKeeperKey(ns),
				Value: newActiveKeeperValueJson,
			},
			// CAS on the observed active keeper. Update to make sure it still exists
			kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   makeActiveKeeperCasKey(ns, observedActiveKeeper.ResourceVersion),
				Value: casKeyPlaceholder,
			},
			// Delete old version
			kv.BatchOp{
				Mode: kv.BatchOpDelete,
				Key:  makeActiveKeeperCasKey(ns, observedActiveKeeper.ResourceVersion),
			},
			// Create new version
			kv.BatchOp{
				Mode:  kv.BatchOpCreate,
				Key:   makeActiveKeeperCasKey(ns, newActiveKeeperValue.ResourceVersion),
				Value: casKeyPlaceholder,
			},
		)
	}

	if err := s.kv.Batch(ctx, kvSectionKeepers, ops); err != nil {
		// Creates only fail if the active keeper key was created in the meantime and updates only fail
		// if a key was deleted or replaced in the meantime
		var batchErr *kv.BatchError
		if errors.As(err, &batchErr) && (errors.Is(batchErr.Err, kv.ErrNotFound) || errors.Is(batchErr.Err, kv.ErrKeyAlreadyExists)) {
			return keeperConflictErr(ns, name)
		}
		return fmt.Errorf("setting keeper as active: %w", err)
	}

	return nil
}

func (s *kvKeeperMetadataStorage) GetActiveKeeperConfig(ctx context.Context, namespace string) (_ string, _ secretv1beta1.KeeperConfig, err error) {
	ctx, span := s.tracer.Start(ctx, "KVKeeperMetadataStorage.GetActiveKeeperConfig", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()

	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, "KVKeeperMetadataStorage.GetActiveKeeperConfig failed")
			span.RecordError(err)
		}
	}()

	activeKeeper, err := s.getActiveKeeper(ctx, namespace)
	if err != nil {
		return "", nil, err
	}

	// When there are no active keepers, default to the system keeper
	if activeKeeper == nil || activeKeeper.Keeper == nil {
		return contracts.SystemKeeperName, secretv1beta1.NewNamedKeeperConfig(contracts.SystemKeeperName, &secretv1beta1.SystemKeeperConfig{}), nil
	}

	row := activeKeeper.Keeper.Keeper
	return row.Name, parseKeeperConfigJson(row.Name, secretv1beta1.KeeperType(row.Type), row.Payload), nil
}

// getActiveKeeper returns nil when no keeper was ever set as active in the namespace
func (s *kvKeeperMetadataStorage) getActiveKeeper(ctx context.Context, namespace string) (*activeKeeperKV, error) {
	reader, err := s.kv.Get(ctx, kvSectionKeepers, makeActiveKeeperKey(namespace))
	if err != nil {
		if errors.Is(err, resource.ErrNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("fetching active keeper: %w", err)
	}

	activeKeeper, err := parse[activeKeeperKV](reader)
	if err != nil {
		return nil, fmt.Errorf("parsing active keeper: %w", err)
	}

	return &activeKeeper, nil
}

func keeperConflictErr(namespace, name string) error {
	return fmt.Errorf("namespace=%s name=%s: %w", namespace, name, contracts.ErrKeeperConflict)
}

// isKeeperNotFoundErr returns true when a batch failed because the keeper was deleted in the meantime.
// A failure on the keeper cas key means the keeper was updated in the meantime, which is a conflict.
func isKeeperNotFoundErr(err error, namespace, name string) bool {
	var batchErr *kv.BatchError
	return errors.As(err, &batchErr) &&
		errors.Is(batchErr.Err, kv.ErrNotFound) &&
		batchErr.Op.Key == makeKeeperKey(namespace, name)
}

func makeKeeperKey(namespace, name string) string {
	return fmt.Sprintf("%s%s/%s", keeperKeyPrefix, namespace, name)
}

// makeKeeperNamespacePrefix creates a prefix for listing all keepers in a namespace
func makeKeeperNamespacePrefix(namespace string) string {
	return fmt.Sprintf("%s%s/", keeperKeyPrefix, namespace)
}

func makeKeeperCasKey(namespace, name string, resourceVersion int64) string {
	// Add padding to the resource version to ensure lexical sorting works correctly.
	// The maximum int64 has 19 digits (math.MaxInt64)
	return fmt.Sprintf("%s%s/%s/%019d", keeperCasKeyPrefix, namespace, name, resourceVersion)
}

func makeActiveKeeperKey(namespace string) string {
	return fmt.Sprintf("%s%s", activeKeeperKeyPrefix, namespace)
}

func makeActiveKeeperCasKey(namespace string, resourceVersion int64) string {
	// Add padding to the resource version to ensure lexical sorting works correctly.
	// The maximum int64 has 19 digits (math.MaxInt64)
	return fmt.Sprintf("%s%s/%019d", activeKeeperCasKeyPrefix, namespace, resourceVersion)
}
