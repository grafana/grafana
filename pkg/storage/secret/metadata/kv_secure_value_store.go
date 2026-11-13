package metadata

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"slices"
	"strconv"
	"time"

	"uuid"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/metadata/metrics"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

const (
	kvSectionSecureValues = "secret/securevalues"

	// Every kind of key in the section has its own prefix so prefix listings never mix them up
	secretKeyPrefix       = "secure_values/"
	activeSecretKeyPrefix = "active/secure_values/"
	gcKeyPrefix           = "gc/"
)

// Only the existence of the cas key matters, but the kv store rejects creates and updates with empty values.
var casKeyPlaceholder = []byte("{}")

// gcTombstoneKV is the value stored under a gc key. It has what the gc worker needs to find the secure value.
type gcTombstoneKV struct {
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Version   int64  `json:"version"`
}

func makeGcTombstone(namespace, name string, version int64) ([]byte, error) {
	buffer, err := json.Marshal(gcTombstoneKV{Namespace: namespace, Name: name, Version: version})
	if err != nil {
		return nil, fmt.Errorf("json marshaling gc tombstone: %w", err)
	}
	return buffer, nil
}

type kvSecureValueMetadataStorage struct {
	kv           resource.KV
	snowflake    contracts.Snowflake
	clock        contracts.Clock
	tracer       trace.Tracer
	leaseManager *lease.Manager
	metrics      *metrics.StorageMetrics
}

func NewKVSecureValueMetadataStorage(kv resource.KV, snowflake contracts.Snowflake, clock contracts.Clock, tracer trace.Tracer, reg prometheus.Registerer) contracts.SecureValueMetadataStorage {
	return &kvSecureValueMetadataStorage{
		kv:           kv,
		snowflake:    snowflake,
		clock:        clock,
		tracer:       tracer,
		leaseManager: lease.NewManager(kv, "secrets_kv_secure_value_store", "secrets_kv_secure_value_store", reg, lease.WithInternalNowFunc(clock.Now)),
		metrics:      metrics.NewStorageMetrics(reg),
	}
}

var _ contracts.SecureValueMetadataStorage = (*kvSecureValueMetadataStorage)(nil)

// secureValueKV represents the data structure stored in the KV store
type secureValueKV struct {
	// Kubernetes Metadata
	GUID                     string            `json:"guid"`
	Name                     string            `json:"name"`
	Namespace                string            `json:"namespace"`
	Annotations              map[string]string `json:"annotations,omitempty"`
	Labels                   map[string]string `json:"labels,omitempty"`
	Created                  int64             `json:"created"`
	CreatedBy                string            `json:"created_by"`
	Updated                  int64             `json:"updated"`
	UpdatedBy                string            `json:"updated_by"`
	OwnerReferenceAPIGroup   string            `json:"owner_reference_api_group,omitempty"`
	OwnerReferenceAPIVersion string            `json:"owner_reference_api_version,omitempty"`
	OwnerReferenceKind       string            `json:"owner_reference_kind,omitempty"`
	OwnerReferenceName       string            `json:"owner_reference_name,omitempty"`

	// Kubernetes Status
	Version int64 `json:"version"`

	// Spec
	Description string   `json:"description"`
	Keeper      string   `json:"keeper,omitempty"`
	Decrypters  []string `json:"decrypters,omitempty"`
	Ref         string   `json:"ref,omitempty"`
	ExternalID  string   `json:"external_id"`

	// Internal fields, not exposed to clients
	// Garbage collection
	LeaseCreated  int64 `json:"lease_created,omitempty"`
	LeaseDuration int64 `json:"lease_duration"`
	GCAttempts    int   `json:"gc_attempts"`
}

// toKubernetes converts a secureValueKV to a Kubernetes SecureValue
func (sv *secureValueKV) toKubernetes() (*v1beta1.SecureValue, error) {
	resource := &v1beta1.SecureValue{
		Spec: v1beta1.SecureValueSpec{
			Description: sv.Description,
			Decrypters:  sv.Decrypters,
		},
		Status: v1beta1.SecureValueStatus{
			ExternalID: sv.ExternalID,
			Version:    sv.Version,
			Keeper:     sv.Keeper,
		},
	}

	if sv.Ref != "" {
		resource.Spec.Ref = &sv.Ref
	}

	// Set all meta fields
	meta, err := utils.MetaAccessor(resource)
	if err != nil {
		return nil, fmt.Errorf("failed to get meta accessor: %w", err)
	}

	updated := time.Unix(sv.Updated, 0).UTC()

	meta.SetUID(types.UID(sv.GUID))
	meta.SetName(sv.Name)
	meta.SetNamespace(sv.Namespace)
	meta.SetAnnotations(sv.Annotations)
	meta.SetLabels(sv.Labels)
	meta.SetCreatedBy(sv.CreatedBy)
	meta.SetCreationTimestamp(metav1.NewTime(time.Unix(sv.Created, 0).UTC()))
	meta.SetUpdatedBy(sv.UpdatedBy)
	meta.SetUpdatedTimestamp(&updated)
	meta.SetResourceVersionInt64(sv.Updated)

	hasOwnerReference := sv.OwnerReferenceAPIGroup != "" &&
		sv.OwnerReferenceAPIVersion != "" &&
		sv.OwnerReferenceKind != "" &&
		sv.OwnerReferenceName != ""
	if hasOwnerReference {
		meta.SetOwnerReferences([]metav1.OwnerReference{
			{
				APIVersion: schema.GroupVersion{Group: sv.OwnerReferenceAPIGroup, Version: sv.OwnerReferenceAPIVersion}.String(),
				Kind:       sv.OwnerReferenceKind,
				Name:       sv.OwnerReferenceName,
			},
		})
	}

	return resource, nil
}

// fromKubernetes converts a Kubernetes SecureValue to secureValueKV
func fromKubernetes(createdAt, updatedAt int64, keeper string, sv *v1beta1.SecureValue, actorUID string, externalID string) (*secureValueKV, error) {
	meta, err := utils.MetaAccessor(sv)
	if err != nil {
		return nil, fmt.Errorf("failed to get meta accessor: %w", err)
	}

	if meta.GetFolder() != "" {
		return nil, fmt.Errorf("folders are not supported")
	}

	var (
		ownerReferenceAPIGroup   string
		ownerReferenceAPIVersion string
		ownerReferenceKind       string
		ownerReferenceName       string
	)

	ownerReferences := meta.GetOwnerReferences()
	if len(ownerReferences) > 1 {
		return nil, fmt.Errorf("only one owner reference is supported, found %d: %w", len(ownerReferences), contracts.ErrTooManyOwnerReferences)
	}
	if len(ownerReferences) == 1 {
		ownerReference := ownerReferences[0]

		gv, err := schema.ParseGroupVersion(ownerReference.APIVersion)
		if err != nil {
			return nil, fmt.Errorf("failed to parse owner reference API version %s: %w", ownerReference.APIVersion, err)
		}
		if gv.Group == "" {
			return nil, fmt.Errorf("malformed api version %s requires <group>/<version> format", ownerReference.APIVersion)
		}

		ownerReferenceAPIGroup = gv.Group
		ownerReferenceAPIVersion = gv.Version
		ownerReferenceKind = ownerReference.Kind
		ownerReferenceName = ownerReference.Name
	}

	// Clean annotations
	annotations := sv.Annotations
	if len(annotations) > 0 {
		annotations = xkube.CleanAnnotations(annotations)
	}

	ref := ""
	if sv.Spec.Ref != nil {
		ref = *sv.Spec.Ref
	}

	kvValue := &secureValueKV{
		GUID:                     string(sv.UID),
		Name:                     sv.Name,
		Namespace:                sv.Namespace,
		Annotations:              annotations,
		Labels:                   sv.Labels,
		Created:                  createdAt,
		CreatedBy:                actorUID,
		Updated:                  updatedAt,
		UpdatedBy:                actorUID,
		OwnerReferenceAPIGroup:   ownerReferenceAPIGroup,
		OwnerReferenceAPIVersion: ownerReferenceAPIVersion,
		OwnerReferenceKind:       ownerReferenceKind,
		OwnerReferenceName:       ownerReferenceName,
		Version:                  sv.Status.Version,
		Description:              sv.Spec.Description,
		Keeper:                   keeper,
		Decrypters:               sv.Spec.Decrypters,
		Ref:                      ref,
		ExternalID:               externalID,
	}

	return kvValue, nil
}

// readValue reads and unmarshals a secure value from KV store
func (s *kvSecureValueMetadataStorage) readValue(ctx context.Context, key string) (*secureValueKV, error) {
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.readValue", trace.WithAttributes(
		attribute.String("key", key),
	))
	defer span.End()
	reader, err := s.kv.Get(ctx, kvSectionSecureValues, key)
	if err != nil {
		if errors.Is(err, resource.ErrNotFound) {
			return nil, contracts.ErrSecureValueNotFound
		}

		return nil, fmt.Errorf("failed to get value: %w", err)
	}

	value, err := parse[secureValueKV](reader)
	if err != nil {
		return nil, fmt.Errorf("parsing secure value: %w", err)
	}
	return &value, nil
}

func (s *kvSecureValueMetadataStorage) Create(ctx context.Context, keeper string, sv *v1beta1.SecureValue, actorUID string) (_ *v1beta1.SecureValue, svmCreateErr error) {
	start := s.clock.Now()
	name := sv.GetName()
	namespace := sv.GetNamespace()

	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.Create", trace.WithAttributes(
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
			span.SetStatus(codes.Error, "KVSecureValueMetadataStorage.Create failed")
			span.RecordError(svmCreateErr)
			args = append(args, "error", svmCreateErr)
		}

		logging.FromContext(ctx).Info("KVSecureValueMetadataStorage.Create", args...)

		s.metrics.KVSecureValueMetadataCreateDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	var (
		createdAt int64
		createdBy string
	)

	// If there's an active version, this is an update and the creation metadata is preserved.
	// The active version is not touched here, SetVersionToActive is responsible for replacing it.
	activeSecureValue, err := s.getActiveVersion(ctx, namespace, name)
	switch {
	case err == nil:
		createdAt = activeSecureValue.Created
		createdBy = activeSecureValue.CreatedBy
	case errors.Is(err, resource.ErrNotFound):
	default:
		return nil, fmt.Errorf("fetching active secure value: %w", err)
	}

	// Versions are unique and never reused
	sv.Status.Version = s.snowflake.Generate()

	now := s.clock.Now().UTC().Unix()

	if createdAt == 0 {
		createdAt = now
	}

	value, err := fromKubernetes(createdAt, now, keeper, sv, actorUID, "")
	if err != nil {
		return nil, err
	}

	// Every version gets its own guid, like the sql store
	value.GUID = uuid.NewV4().String()

	if createdBy != "" {
		value.CreatedBy = createdBy
	}

	buffer, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("json marshaling secure value: %w", err)
	}

	gcTombstone, err := makeGcTombstone(namespace, name, value.Version)
	if err != nil {
		return nil, err
	}

	if err := s.kv.Batch(ctx, kvSectionSecureValues, []kv.BatchOp{
		// Create the secure value metadata
		{
			Mode:  kv.BatchOpCreate,
			Key:   makeSecretKey(namespace, name, value.Version),
			Value: buffer,
		},
		// The secure value starts inactive so it must have a gc key until it's activated
		{
			Mode:  kv.BatchOpCreate,
			Key:   makeGcKey(namespace, name, value.Version),
			Value: gcTombstone,
		},
	}); err != nil {
		return nil, fmt.Errorf("writing secure value to kv store: %w", err)
	}

	newVersionK8s, err := value.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("converting new secure value version to k8s format: %w", err)
	}

	return newVersionK8s, nil
}

func (s *kvSecureValueMetadataStorage) Delete(ctx context.Context, in []contracts.SecureValueIdentifier) (err error) {
	start := s.clock.Now()
	inputStr := fmt.Sprintf("%+v", in)
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.Delete", trace.WithAttributes(
		attribute.String("input", inputStr),
	))
	defer span.End()

	defer func() {
		success := err == nil
		args := []any{
			"input", inputStr,
			"success", success,
		}

		if !success {
			span.SetStatus(codes.Error, "KVSecureValueMetadataStorage.Delete failed")
			span.RecordError(err)
			args = append(args, "error", err)
		}

		logging.FromContext(ctx).Info("KVSecureValueMetadataStorage.Delete", args...)
		s.metrics.KVSecureValueDeleteDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	if len(in) == 0 {
		return nil
	}

	// Each secure value takes 2 ops. Deletes are idempotent so a failure after some batches have been applied is fixed by retrying.
	for chunk := range slices.Chunk(in, kv.MaxBatchOps/2) {
		ops := make([]kv.BatchOp, 0, 2*len(chunk))
		for _, id := range chunk {
			ns := id.Namespace.String()
			ops = append(ops,
				// Delete the secure value
				kv.BatchOp{
					Mode: kv.BatchOpDelete,
					Key:  makeSecretKey(ns, id.Name, id.Version),
				},
				// Delete the gc key for the deleted secure value
				kv.BatchOp{
					Mode: kv.BatchOpDelete,
					Key:  makeGcKey(ns, id.Name, id.Version),
				},
			)
		}

		if err := s.kv.Batch(ctx, kvSectionSecureValues, ops); err != nil {
			return fmt.Errorf("batch deleting secure values from kv store: %w", err)
		}
	}

	return nil
}

func (s *kvSecureValueMetadataStorage) LeaseInactiveSecureValues(ctx context.Context, maxBatchSize uint16) (_ []v1beta1.SecureValue, err error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.LeaseInactiveSecureValues", trace.WithAttributes(
		attribute.Int("maxBatchSize", int(maxBatchSize)),
	))

	defer span.End()

	defer func() {
		success := err == nil

		if !success {
			span.SetStatus(codes.Error, "KVSecureValueMetadataStorage.LeaseInactiveSecureValues failed")
			span.RecordError(err)
		}

		s.metrics.KVSecureValueLeaseInactiveDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	// TODO: make it configurable
	const (
		minAge   = 10 * time.Minute
		leaseTTL = 5 * time.Minute
	)

	now := s.clock.Now().UTC().Unix()

	// First, collect all eligible items with their keys
	type eligibleItem struct {
		key   string
		value *secureValueKV
	}
	eligible := make([]eligibleItem, 0)

	gcKeys := make([]string, 0, maxBatchSize)

	// TODO: unbounded number of entries
	for gcKey, err := range s.kv.Keys(ctx, kvSectionSecureValues, resource.ListOptions{
		StartKey: gcKeyPrefix,
		EndKey:   resource.PrefixRangeEnd(gcKeyPrefix),
		Limit:    1024,
	}) {
		if err != nil {
			return nil, fmt.Errorf("listing gc keys in the kv store: %w", err)
		}
		gcKeys = append(gcKeys, gcKey)
	}

	keys := make([]string, 0, len(gcKeys))

	for keyValue, err := range s.kv.BatchGet(ctx, kvSectionSecureValues, gcKeys) {
		if err != nil {
			return nil, fmt.Errorf("fetching gc tombstones from kv store: %w", err)
		}

		tombstone, err := parse[gcTombstoneKV](keyValue.Value)
		if err != nil {
			return nil, fmt.Errorf("parsing gc tombstone: %w", err)
		}
		key := makeSecretKey(tombstone.Namespace, tombstone.Name, tombstone.Version)
		keys = append(keys, key)
	}

	for keyValue, err := range s.kv.BatchGet(ctx, kvSectionSecureValues, keys) {
		if err != nil {
			return nil, fmt.Errorf("fetching batch from kv store: %w", err)
		}

		value, err := parse[secureValueKV](keyValue.Value)
		if err != nil {
			return nil, fmt.Errorf("parsing secure value: %w", err)
		}

		// Check if this value is eligible for leasing.
		// Note that the updated field is used for the eligiblity check.
		ageSeconds := now - value.Updated
		leaseAgeSeconds := now - value.LeaseCreated

		if ageSeconds > int64(minAge.Seconds()) && leaseAgeSeconds > value.LeaseDuration {
			eligible = append(eligible, eligibleItem{
				key:   keyValue.Key,
				value: &value,
			})
			if len(eligible) >= int(maxBatchSize) {
				break
			}
		}
	}

	toUpdate := make([]eligibleItem, 0, len(eligible))
	leases := []*lease.Lease{}
	defer func() {
		for _, l := range leases {
			if err := s.leaseManager.Release(ctx, l); err != nil && !errors.Is(err, lease.ErrLeaseLost) {
				logging.FromContext(ctx).Error("releasing lease", "err", err.Error())
			}
		}
	}()

	for i := 0; i < len(eligible); i++ {
		item := eligible[i]
		l, err := s.leaseManager.Acquire(ctx, item.key)
		if err != nil {
			if errors.Is(err, lease.ErrLeaseAlreadyHeld) {
				continue
			}
			return nil, fmt.Errorf("acquiring lease: %w", err)
		}
		leases = append(leases, l)

		item.value.LeaseCreated = now
		item.value.LeaseDuration = int64(leaseTTL.Seconds() * math.Pow(2, float64(item.value.GCAttempts)))
		toUpdate = append(toUpdate, item)
	}

	result := make([]v1beta1.SecureValue, 0, min(int(maxBatchSize), len(eligible)))

	if len(toUpdate) > 0 {
		ops := make([]kv.BatchOp, 0, len(toUpdate))
		for _, entry := range toUpdate {
			buffer, err := json.Marshal(entry.value)
			if err != nil {
				return nil, fmt.Errorf("json marshaling secure value: %w", err)
			}
			ops = append(ops, kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   entry.key,
				Value: buffer,
			})

			k8s, err := entry.value.toKubernetes()
			if err != nil {
				return nil, fmt.Errorf("converting secure value to k8s model: %w", err)
			}
			result = append(result, *k8s)
		}
		// A failure after some chunks have been applied leaves those secure values leased until the lease expires
		for chunk := range slices.Chunk(ops, kv.MaxBatchOps) {
			if err := s.kv.Batch(ctx, kvSectionSecureValues, chunk); err != nil {
				return nil, fmt.Errorf("sending batch query to kv store: %w", err)
			}
		}
	}

	return result, nil
}

func (s *kvSecureValueMetadataStorage) List(ctx context.Context, namespace xkube.Namespace) (svList []v1beta1.SecureValue, listErr error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.List", trace.WithAttributes(
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
			span.SetStatus(codes.Error, "KVSecureValueMetadataStorage.List failed")
			span.RecordError(listErr)
			args = append(args, "error", listErr)
		}

		logging.FromContext(ctx).Info("KVSecureValueMetadataStorage.List", args...)

		s.metrics.KVSecureValueMetadataListDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	// Each secure value has at most one active key so there's no need to deduplicate versions
	prefix := makeActiveNamespacePrefix(namespace.String())
	result := make([]v1beta1.SecureValue, 0)

	keys := make([]string, 0)

	// TODO: unbounded number of entries
	for key, err := range s.kv.Keys(ctx, kvSectionSecureValues, resource.ListOptions{
		StartKey: prefix,
		EndKey:   resource.PrefixRangeEnd(prefix),
	}) {
		if err != nil {
			return nil, fmt.Errorf("listing active keys in the kv store: %w", err)
		}

		keys = append(keys, key)
	}

	for kv, err := range s.kv.BatchGet(ctx, kvSectionSecureValues, keys) {
		if err != nil {
			return nil, fmt.Errorf("BatchGet returned error: %w", err)
		}
		value, err := parse[secureValueKV](kv.Value)
		if err != nil {
			return nil, fmt.Errorf("parsing secure value: %w", err)
		}

		sv, err := value.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("failed to convert to Kubernetes format: %w", err)
		}

		result = append(result, *sv)
	}

	return result, nil
}

func (s *kvSecureValueMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (_ *v1beta1.SecureValue, readErr error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.Read", trace.WithAttributes(
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
			span.SetStatus(codes.Error, "KVSecureValueMetadataStorage.Read failed")
			span.RecordError(readErr)
			args = append(args, "error", readErr)
		}

		logging.FromContext(ctx).Info("KVSecureValueMetadataStorage.Read", args...)
		s.metrics.KVSecureValueMetadataGetDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	value, err := s.getActiveVersion(ctx, namespace.String(), name)
	if err != nil {
		if errors.Is(err, resource.ErrNotFound) {
			return nil, contracts.ErrSecureValueNotFound
		}
		return nil, fmt.Errorf("fetching active secure value: %w", err)
	}

	return value.toKubernetes()
}

func (s *kvSecureValueMetadataStorage) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, version int64, externalID contracts.ExternalID) (setExtIDErr error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.SetExternalID", trace.WithAttributes(
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
			span.SetStatus(codes.Error, "KVSecureValueMetadataStorage.SetExternalID failed")
			span.RecordError(setExtIDErr)
			args = append(args, "error", setExtIDErr)
		}

		logging.FromContext(ctx).Info("KVSecureValueMetadataStorage.SetExternalID", args...)
		s.metrics.KVSecureValueSetExternalIDDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	key := makeSecretKey(namespace.String(), name, version)

	value, err := s.readValue(ctx, key)
	if err != nil {
		return err
	}

	value.ExternalID = externalID.String()

	buffer, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("json marshaling secure value: %w", err)
	}

	// Update instead of save so a secure value deleted by the gc worker in the meantime is not recreated
	if err := s.kv.Batch(ctx, kvSectionSecureValues, []kv.BatchOp{
		{
			Mode:  kv.BatchOpUpdate,
			Key:   key,
			Value: buffer,
		},
	}); err != nil {
		if isKeyNotFoundBatchErr(err) {
			return contracts.ErrSecureValueNotFound
		}
		return fmt.Errorf("storing secure value in kv store: %w", err)
	}

	return nil
}

func (s *kvSecureValueMetadataStorage) SetVersionToActive(ctx context.Context, namespace xkube.Namespace, name string, version, observedVersion int64) error {
	ns := namespace.String()
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.SetVersionToActive", trace.WithAttributes(
		attribute.String("namespace", ns),
		attribute.String("name", name),
		attribute.Int64("version", version),
		attribute.Int64("observedVersion", observedVersion),
	))
	defer span.End()

	var ops []kv.BatchOp

	// Read the row instead of using the caller's value because it has the internal fields and the external id
	secureValue, err := s.readValue(ctx, makeSecretKey(ns, name, version))
	if err != nil {
		return fmt.Errorf("reading secure value: %w", err)
	}
	secureValueJson, err := json.Marshal(secureValue)
	if err != nil {
		return fmt.Errorf("json marshaling secure value: %w", err)
	}

	// There's no active version
	if observedVersion == 0 {
		// The creates fail if another version was activated in the meantime
		ops = []kv.BatchOp{
			// Create an active key that marks this secure value as the active one
			{
				Mode:  kv.BatchOpCreate,
				Key:   makeActiveSecretKey(ns, name),
				Value: secureValueJson,
			},
			// Create the CAS key for the active key
			{
				Mode:  kv.BatchOpCreate,
				Key:   makeActiveSecretCasKey(ns, name, version),
				Value: casKeyPlaceholder,
			},
			// The secure value is now active, delete the GC key so the GC worker doesn't delete the secure value
			{
				Mode: kv.BatchOpDelete,
				Key:  makeGcKey(ns, name, version),
			},
		}
	} else {
		// There's an active version, replace it.
		activeSecureValue, err := s.getActiveVersion(ctx, ns, name)
		if err != nil {
			// The observed version was deleted in the meantime
			if errors.Is(err, resource.ErrNotFound) {
				return secureValueConflictErr(ns, name)
			}
			return fmt.Errorf("fetching active secure value: %w", err)
		}

		// The CAS below would fail anyway, fail early
		if activeSecureValue.Version != observedVersion {
			return secureValueConflictErr(ns, name)
		}

		activeSecureValueJson, err := json.Marshal(activeSecureValue)
		if err != nil {
			return fmt.Errorf("json marshaling active secure value: %w", err)
		}

		gcTombstone, err := makeGcTombstone(ns, name, activeSecureValue.Version)
		if err != nil {
			return err
		}

		ops = []kv.BatchOp{
			// Mark this secure value as the active one
			{
				Mode:  kv.BatchOpUpdate,
				Key:   makeActiveSecretKey(ns, name),
				Value: secureValueJson,
			},
			// CAS on the observed active secure value. Update to make sure it still exists
			{
				Mode:  kv.BatchOpUpdate,
				Key:   makeActiveSecretCasKey(ns, name, observedVersion),
				Value: casKeyPlaceholder,
			},
			// Delete old version
			{
				Mode: kv.BatchOpDelete,
				Key:  makeActiveSecretCasKey(ns, name, observedVersion),
			},
			// Create new version
			{
				Mode:  kv.BatchOpCreate,
				Key:   makeActiveSecretCasKey(ns, name, version),
				Value: casKeyPlaceholder,
			},
			// The previously active version is now inactive and can be garbage collected
			{
				Mode:  kv.BatchOpCreate,
				Key:   makeGcKey(ns, name, activeSecureValue.Version),
				Value: gcTombstone,
			},
			// Update to make sure the previously active version still exists
			{
				Mode:  kv.BatchOpUpdate,
				Key:   makeSecretKey(ns, name, activeSecureValue.Version),
				Value: activeSecureValueJson,
			},
			// The secure value is now active, delete the GC key so the GC worker doesn't delete the secure value
			{
				Mode: kv.BatchOpDelete,
				Key:  makeGcKey(ns, name, version),
			},
		}
	}

	if err := s.kv.Batch(ctx, kvSectionSecureValues, ops); err != nil {
		// When no version was observed, the active key can only exist if another version is active.
		// The cas key can't already exist because versions are never reused.
		var batchErr *kv.BatchError
		if observedVersion == 0 &&
			errors.As(err, &batchErr) &&
			errors.Is(batchErr.Err, kv.ErrKeyAlreadyExists) &&
			batchErr.Op.Key == makeActiveSecretKey(ns, name) {
			return fmt.Errorf("namespace=%+v name=%+v %w", ns, name, contracts.ErrSecureValueAlreadyExists)
		}

		if isKeyNotFoundBatchErr(err) {
			return secureValueConflictErr(ns, name)
		}

		return fmt.Errorf("executing kv batch operations: %w", err)
	}

	return nil
}

func (s *kvSecureValueMetadataStorage) SetVersionToInactive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error {
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.SetVersionToInactive", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.Int64("version", version),
	))
	defer span.End()

	ns := namespace.String()

	gcTombstone, err := makeGcTombstone(ns, name, version)
	if err != nil {
		return err
	}

	// version is the active version observed by the caller
	if err := s.kv.Batch(ctx, kvSectionSecureValues, []kv.BatchOp{
		// CAS on the active secure value key. Update to make sure it still exists
		{
			Mode:  kv.BatchOpUpdate,
			Key:   makeActiveSecretCasKey(ns, name, version),
			Value: casKeyPlaceholder,
		},
		// Delete the CAS key and the active key. No version is active anymore.
		{
			Mode: kv.BatchOpDelete,
			Key:  makeActiveSecretCasKey(ns, name, version),
		},
		{
			Mode: kv.BatchOpDelete,
			Key:  makeActiveSecretKey(ns, name),
		},
		// The previously active version is now inactive and can be garbage collected so create a tombstone for it
		{
			Mode:  kv.BatchOpCreate,
			Key:   makeGcKey(ns, name, version),
			Value: gcTombstone,
		},
	}); err != nil {
		if isKeyNotFoundBatchErr(err) {
			return secureValueConflictErr(ns, name)
		}
		return fmt.Errorf("executing kv batch operations: %w", err)
	}

	return nil
}

// isKeyNotFoundBatchErr returns true when a batch failed because a key it updates doesn't exist.
// Updates are only used to CAS on keys that must still exist, so this means the state changed in the meantime.
func isKeyNotFoundBatchErr(err error) bool {
	var batchErr *kv.BatchError
	return errors.As(err, &batchErr) && errors.Is(batchErr.Err, kv.ErrNotFound)
}

func secureValueConflictErr(namespace, name string) error {
	return fmt.Errorf("namespace=%+v name=%+v %w", namespace, name, contracts.ErrSecureValueConflict)
}

func (s *kvSecureValueMetadataStorage) getActiveVersion(ctx context.Context, namespace string, name string) (secureValueKV, error) {
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.getActiveVersion", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
	))
	defer span.End()

	reader, err := s.kv.Get(ctx, kvSectionSecureValues, makeActiveSecretKey(namespace, name))
	if err != nil {
		return secureValueKV{}, fmt.Errorf("fetching active secure value version: %w", err)
	}
	parsed, err := parse[secureValueKV](reader)
	if err != nil {
		return secureValueKV{}, fmt.Errorf("parsing secure value: %w", err)
	}
	return parsed, nil
}

func (s *kvSecureValueMetadataStorage) IncGCAttemptCount(ctx context.Context, in []contracts.SecureValueIdentifier) (_ map[string]int, err error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.IncGCAttemptCount", trace.WithAttributes(
		attribute.String("input", fmt.Sprintf("%+v", in)),
	))

	defer span.End()

	defer func() {
		success := err == nil

		if !success {
			span.SetStatus(codes.Error, "KVSecureValueMetadataStorage.IncGCAttemptCount failed")
			span.RecordError(err)
		}

		logging.FromContext(ctx).Info("KVSecureValueMetadataStorage.IncGCAttemptCount", "input", in, "err", err)
		s.metrics.KVSecureValueIncGCAttemptCount.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	keys := make([]string, 0, len(in))
	gcKeys := make([]string, 0, len(in))
	for _, in := range in {
		keys = append(keys, makeSecretKey(in.Namespace.String(), in.Name, in.Version))
		gcKeys = append(gcKeys, makeGcKey(in.Namespace.String(), in.Name, in.Version))
	}

	// Only inactive secure values have gc keys. Like the sql store, only inactive secure values have their count incremented.
	inactive := make(map[string]bool, len(gcKeys))
	for kvValue, err := range s.kv.BatchGet(ctx, kvSectionSecureValues, gcKeys) {
		if err != nil {
			return nil, fmt.Errorf("batch getting gc keys: %w", err)
		}
		_ = kvValue.Value.Close()
		inactive[kvValue.Key] = true
	}

	count := make(map[string]int, len(keys))
	toUpdate := make(map[string]secureValueKV, len(keys))

	for kvValue, err := range s.kv.BatchGet(ctx, kvSectionSecureValues, keys) {
		if err != nil {
			return nil, fmt.Errorf("batch getting gc metadata: %w", err)
		}
		parsed, err := parse[secureValueKV](kvValue.Value)
		if err != nil {
			return nil, fmt.Errorf("parsing secure value gc metadata: %w", err)
		}

		if !inactive[makeGcKey(parsed.Namespace, parsed.Name, parsed.Version)] {
			count[parsed.GUID] = parsed.GCAttempts
			continue
		}

		parsed.GCAttempts += 1
		toUpdate[kvValue.Key] = parsed
		count[parsed.GUID] = parsed.GCAttempts
	}

	if len(toUpdate) > 0 {
		ops := make([]kv.BatchOp, 0, 2*len(toUpdate))
		for key, metadata := range toUpdate {
			value, err := json.Marshal(metadata)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal gc metadata: %w", err)
			}
			gcTombstone, err := makeGcTombstone(metadata.Namespace, metadata.Name, metadata.Version)
			if err != nil {
				return nil, err
			}
			ops = append(ops,
				// No-op update that fails if the secure value was activated in the meantime
				kv.BatchOp{
					Mode:  kv.BatchOpUpdate,
					Key:   makeGcKey(metadata.Namespace, metadata.Name, metadata.Version),
					Value: gcTombstone,
				},
				kv.BatchOp{
					Mode:  kv.BatchOpUpdate,
					Key:   key,
					Value: value,
				},
			)
		}
		// Will fail if a secure value has been deleted in the meantime.
		// Each secure value takes 2 ops and they're always in the same batch because MaxBatchOps is even.
		for chunk := range slices.Chunk(ops, kv.MaxBatchOps) {
			if err := s.kv.Batch(ctx, kvSectionSecureValues, chunk); err != nil {
				return nil, fmt.Errorf("batch updating secure values: %w", err)
			}
		}
	}

	return count, nil
}

func parse[T any](reader io.ReadCloser) (T, error) {
	defer func() {
		_ = reader.Close()
	}()

	data, err := io.ReadAll(reader)
	if err != nil {
		var zero T
		return zero, fmt.Errorf("failed to read value: %w", err)
	}

	var value T

	if err := json.Unmarshal(data, &value); err != nil {
		return value, fmt.Errorf("failed to unmarshal value: %w", err)
	}

	return value, nil
}

func (s *kvSecureValueMetadataStorage) SetInactiveAllFromGroup(ctx context.Context, namespace xkube.Namespace, apiGroup string) (err error) {
	start := s.clock.Now()
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.SetInactiveAllFromGroup", trace.WithAttributes(
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
			span.SetStatus(codes.Error, "KVSecureValueMetadataStorage.SetInactiveAllFromGroup failed")
			span.RecordError(err)
			args = append(args, "error", err)
		}

		logging.FromContext(ctx).Debug("KVSecureValueMetadataStorage.SetInactiveAllFromGroup", args...)
		s.metrics.KVSecureValueSetInactiveAllFromGroupDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	ns := namespace.String()
	prefix := makeActiveNamespacePrefix(ns)

	keys := make([]string, 0)

	// TODO: unbounded number of entries
	for key, err := range s.kv.Keys(ctx, kvSectionSecureValues, resource.ListOptions{
		StartKey: prefix,
		EndKey:   resource.PrefixRangeEnd(prefix),
	}) {
		if err != nil {
			return fmt.Errorf("listing active keys in the kv store: %w", err)
		}
		keys = append(keys, key)
	}

	ops := make([]kv.BatchOp, 0)

	// The active keys have a copy of the active secure value so they're enough to check the owner
	for keyValue, err := range s.kv.BatchGet(ctx, kvSectionSecureValues, keys) {
		if err != nil {
			return fmt.Errorf("fetching active secure values from kv store: %w", err)
		}

		value, err := parse[secureValueKV](keyValue.Value)
		if err != nil {
			return fmt.Errorf("parsing secure value: %w", err)
		}

		if value.OwnerReferenceAPIGroup != apiGroup {
			continue
		}

		gcTombstone, err := makeGcTombstone(ns, value.Name, value.Version)
		if err != nil {
			return err
		}

		ops = append(ops,
			// CAS on the active secure value key. Update to make sure it still exists
			kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   makeActiveSecretCasKey(ns, value.Name, value.Version),
				Value: casKeyPlaceholder,
			},
			// Delete the CAS key and the active key. No version is active anymore.
			kv.BatchOp{
				Mode: kv.BatchOpDelete,
				Key:  makeActiveSecretCasKey(ns, value.Name, value.Version),
			},
			kv.BatchOp{
				Mode: kv.BatchOpDelete,
				Key:  makeActiveSecretKey(ns, value.Name),
			},
			// The previously active version is now inactive and can be garbage collected so create a tombstone for it
			kv.BatchOp{
				Mode:  kv.BatchOpCreate,
				Key:   makeGcKey(ns, value.Name, value.Version),
				Value: gcTombstone,
			},
		)
	}

	// Each secure value takes 4 ops and they're always in the same batch because MaxBatchOps is a multiple of 4.
	// Unlike the sql store this is not atomic, a failure after some batches have been applied is fixed by retrying.
	for chunk := range slices.Chunk(ops, kv.MaxBatchOps) {
		if err := s.kv.Batch(ctx, kvSectionSecureValues, chunk); err != nil {
			if isKeyNotFoundBatchErr(err) {
				return fmt.Errorf("namespace=%+v apiGroup=%+v %w", ns, apiGroup, contracts.ErrSecureValueConflict)
			}
			return fmt.Errorf("batch setting secure values as inactive: %w", err)
		}
	}

	return nil
}

func makeSecretKey(namespace, name string, version int64) string {
	// Add padding to version to ensure lexical sorting works correctly.
	// The maximum int64 has 19 digits (math.MaxInt64)
	return fmt.Sprintf("%s%s/%s/%019d", secretKeyPrefix, namespace, name, version)
}

func makeActiveSecretKey(namespace, name string) string {
	return fmt.Sprintf("%s%s/%s", activeSecretKeyPrefix, namespace, name)
}

// makeActiveNamespacePrefix creates a prefix for listing the active versions of all resources in a namespace
func makeActiveNamespacePrefix(namespace string) string {
	return fmt.Sprintf("%s%s/", activeSecretKeyPrefix, namespace)
}

func makeActiveSecretCasKey(namespace, name string, version int64) string {
	return fmt.Sprintf("cas/active/%s/%s/%019d", namespace, name, version)
}

func makeGcKey(namespace, name string, version int64) string {
	// Versions are snowflake ids so they are time ordered and work as the timestamp prefix.
	// Add padding to version to ensure lexical sorting works correctly.
	// The maximum int64 has 19 digits (math.MaxInt64)
	return fmt.Sprintf("%s%019d/%s/%s", gcKeyPrefix, version, namespace, name)
}
