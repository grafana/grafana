package metadata

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"slices"
	"strconv"
	"time"

	"github.com/google/uuid"
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
)

type kvSecureValueMetadataStorage struct {
	kv           resource.KV
	clock        contracts.Clock
	tracer       trace.Tracer
	leaseManager *lease.Manager
	metrics      *metrics.StorageMetrics
}

func NewkvSecureValueMetadataStorage(kv resource.KV, clock contracts.Clock, tracer trace.Tracer, reg prometheus.Registerer) contracts.SecureValueMetadataStorage {
	return &kvSecureValueMetadataStorage{
		kv:           kv,
		clock:        clock,
		tracer:       tracer,
		leaseManager: lease.NewManager(kv, "secrets_kv_secure_value_metadata_storage", nil),
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
	Active  bool  `json:"active"`
	Version int64 `json:"version"`

	// Spec
	Description string   `json:"description"`
	Keeper      string   `json:"keeper,omitempty"`
	Decrypters  []string `json:"decrypters,omitempty"`
	Ref         string   `json:"ref,omitempty"`
	ExternalID  string   `json:"external_id"`

	// Internal fields, not exposed to clients
	// Gargbage collection
	LeaseToken    string `json:"lease_token,omitempty"`
	LeaseCreated  int64  `json:"lease_created,omitempty"`
	LeaseDuration int64  `json:"lease_duration"`
	GCAttempts    int    `json:"gc_atttempts"`
}

// makePrefix creates a prefix for listing all versions of a resource
func makePrefix(namespace, name string) string {
	return fmt.Sprintf("%s/%s/", namespace, name)
}

// makeNamespacePrefix creates a prefix for listing all resources in a namespace
func makeNamespacePrefix(namespace string) string {
	return fmt.Sprintf("%s/", namespace)
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
		Active:                   false,
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

	value, err := parseSecureValue(reader)
	if err != nil {
		return nil, fmt.Errorf("parsing secure value: %w", err)
	}
	return &value, nil
}

// writeValue marshals and writes a secure value to KV store
func (s *kvSecureValueMetadataStorage) writeValue(ctx context.Context, key string, value *secureValueKV) error {
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.writeValue", trace.WithAttributes(attribute.String("key", key)))
	defer span.End()

	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	writer, err := s.kv.Save(ctx, kvSectionSecureValues, key)
	if err != nil {
		return fmt.Errorf("failed to save value: %w", err)
	}

	if _, err := io.Copy(writer, bytes.NewReader(data)); err != nil {
		_ = writer.Close()
		return fmt.Errorf("failed to write value: %w", err)
	}

	if err := writer.Close(); err != nil {
		return fmt.Errorf("failed to close writer: %w", err)
	}

	return nil
}

func (s *kvSecureValueMetadataStorage) getLatestVersion(ctx context.Context, namespace, name string) (latestVersion int64, createdAt int64, err error) {
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.getLatestVersion", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", namespace)))
	defer span.End()

	prefix := makePrefix(namespace, name)

	for key, err := range s.kv.Keys(ctx, kvSectionSecureValues, resource.ListOptions{
		StartKey: prefix,
		EndKey:   resource.PrefixRangeEnd(prefix),
		Sort:     resource.SortOrderDesc,
		Limit:    1,
	}) {
		if err != nil {
			return 0, 0, err
		}

		value, err := s.readValue(ctx, key)
		if err != nil {
			return 0, 0, err
		}

		latestVersion = value.Version
		if value.Active {
			createdAt = value.Created
		}

		break
	}

	// TODO: return created by? check sql impl
	return latestVersion, createdAt, nil
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

	latestVersion, createdAt, err := s.getLatestVersion(ctx, sv.Namespace, sv.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest version: %w", err)
	}

	newVersion := latestVersion + 1
	sv.Status.Version = newVersion

	now := s.clock.Now().UTC().Unix()

	// Preserve creation time if this is an update
	if createdAt == 0 {
		createdAt = now
	}

	value, err := fromKubernetes(createdAt, now, keeper, sv, actorUID, "")
	if err != nil {
		return nil, err
	}

	// Generate UUID if not set
	if value.GUID == "" {
		value.GUID = uuid.New().String()
	}

	// Save the new version (it starts as inactive)
	key := makeKey(sv.Namespace, sv.Name, sv.Status.Version)
	if err := s.writeValue(ctx, key, value); err != nil {
		return nil, fmt.Errorf("failed to write value: %w", err)
	}

	return value.toKubernetes()
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

	keys := make([]string, 0, len(in))
	for _, in := range in {
		keys = append(keys, makeKey(in.Namespace.String(), in.Name, in.Version))
	}

	if err := s.kv.BatchDelete(ctx, kvSectionSecureValues, keys); err != nil {
		return fmt.Errorf("batch deleting secure values from kv store: %+v", err)
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

		s.metrics.KVSecureValueDeleteDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	// TODO: make it configurable
	const (
		minAge   = 10 * time.Minute
		leaseTTL = 5 * time.Minute
	)

	leaseToken := uuid.NewString()

	now := s.clock.Now().UTC().Unix()

	// First, collect all eligible items with their keys
	type eligibleItem struct {
		key   string
		value *secureValueKV
	}
	eligible := make([]eligibleItem, 0)

	keys := make([]string, 0)

	for key, err := range s.kv.Keys(ctx, kvSectionSecureValues, resource.ListOptions{}) {
		if err != nil {
			return nil, fmt.Errorf("listing keys in the kv store: %w", err)
		}
		keys = append(keys, key)
	}

	for keyValue, err := range s.kv.BatchGet(ctx, kvSectionSecureValues, keys) {
		if err != nil {
			return nil, fmt.Errorf("fetching batch from kv store: %w", err)
		}

		value, err := parseSecureValue(keyValue.Value)
		if err != nil {
			return nil, fmt.Errorf("parsing secure value: %w", err)
		}

		// Check if this value is eligible for leasing.
		// Note that the updated field is used for the eligiblity check.
		ageSeconds := now - value.Updated
		leaseAgeSeconds := now - value.LeaseCreated

		if !value.Active && ageSeconds > int64(minAge.Seconds()) && leaseAgeSeconds > value.LeaseDuration {
			eligible = append(eligible, eligibleItem{
				key:   keyValue.Key,
				value: &value,
			})
		}
	}

	slices.SortFunc(eligible, func(a, b eligibleItem) int {
		if a.value.Created < b.value.Created {
			return -1
		} else if a.value.Created > b.value.Created {
			return 1
		}

		if a.value.GUID < b.value.GUID {
			return -1
		} else if a.value.GUID > b.value.GUID {
			return 1
		}

		return 0
	})

	toUpdate := make([]eligibleItem, 0, len(eligible))

	for i := 0; i < len(eligible) && i < int(maxBatchSize); i++ {
		item := eligible[i]

		lease, err := s.leaseManager.Acquire(ctx, item.key)
		if err != nil {
			return nil, fmt.Errorf("acquiring kv store lease: %w", err)
		}
		defer func() {
			if err := s.leaseManager.Release(ctx, lease); err != nil {
				logging.FromContext(ctx).Error("releasing kv store lease", "err", err.Error())
			}
		}()

		item.value.LeaseToken = leaseToken
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
				return nil, fmt.Errorf("json marshaling secure value")
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
		if err := s.kv.Batch(ctx, kvSectionSecureValues, ops); err != nil {
			return nil, fmt.Errorf("sending batch query to kv store: %w", err)
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

	prefix := makeNamespacePrefix(namespace.String())
	result := make([]v1beta1.SecureValue, 0)

	seen := make(map[string]struct{}, 0)

	for key, err := range s.kv.Keys(ctx, kvSectionSecureValues, resource.ListOptions{
		StartKey: prefix,
		EndKey:   resource.PrefixRangeEnd(prefix),
		Sort:     resource.SortOrderDesc,
	}) {
		if err != nil {
			return nil, err
		}

		value, err := s.readValue(ctx, key)
		if err != nil {
			return nil, err
		}

		resourceKey := makePrefix(value.Namespace, value.Name)

		if _, ok := seen[resourceKey]; ok {
			continue
		}

		if value.Active {
			sv, err := value.toKubernetes()
			if err != nil {
				return nil, fmt.Errorf("failed to convert to Kubernetes format: %w", err)
			}

			result = append(result, *sv)

			seen[resourceKey] = struct{}{}
		}
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

	prefix := makePrefix(namespace.String(), name)

	// List all versions in descending order to find the active one, which might not be the latest inserted
	for key, err := range s.kv.Keys(ctx, kvSectionSecureValues, resource.ListOptions{
		StartKey: prefix,
		EndKey:   resource.PrefixRangeEnd(prefix),
		Sort:     resource.SortOrderDesc,
	}) {
		if err != nil {
			return nil, err
		}

		value, err := s.readValue(ctx, key)
		if err != nil {
			return nil, err
		}

		if value.Active {
			return value.toKubernetes()
		}
	}

	return nil, contracts.ErrSecureValueNotFound
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

	key := makeKey(namespace.String(), name, version)

	value, err := s.readValue(ctx, key)
	if err != nil {
		return err
	}

	value.ExternalID = externalID.String()

	return s.writeValue(ctx, key, value)
}

func (s *kvSecureValueMetadataStorage) SetVersionToActive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error {
	ctx, span := s.tracer.Start(ctx, "KVSecureValueMetadataStorage.SetVersionToActive", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
		attribute.Int64("version", version),
	))
	defer span.End()

	prefix := makePrefix(namespace.String(), name)
	targetKey := makeKey(namespace.String(), name, version)

	// First, deactivate all versions, this mimics the SQL behavior which happens in a single update query
	for key, err := range s.kv.Keys(ctx, kvSectionSecureValues, resource.ListOptions{
		StartKey: prefix,
		EndKey:   resource.PrefixRangeEnd(prefix),
	}) {
		if err != nil {
			return err
		}

		value, err := s.readValue(ctx, key)
		if err != nil {
			return err
		}

		newActiveValue := key == targetKey

		if value.Active != newActiveValue {
			value.Active = newActiveValue

			if err := s.writeValue(ctx, key, value); err != nil {
				return fmt.Errorf("failed to toggle version to %v: %w", newActiveValue, err)
			}
		}
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

	key := makeKey(namespace.String(), name, version)

	value, err := s.readValue(ctx, key)
	if err != nil {
		return err
	}

	value.Active = false

	return s.writeValue(ctx, key, value)
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
	for _, in := range in {
		keys = append(keys, makeKey(in.Namespace.String(), in.Name, in.Version))
	}

	count := make(map[string]int, len(keys))
	toUpdate := make(map[string]secureValueKV, len(keys))

	for kvValue, err := range s.kv.BatchGet(ctx, kvSectionSecureValues, keys) {
		if err != nil {
			return nil, fmt.Errorf("batch getting gc metadata: %w", err)
		}
		parsed, err := parseSecureValue(kvValue.Value)
		if err != nil {
			return nil, fmt.Errorf("parsing secure value gc metadata: %w", err)
		}

		if parsed.Active {
			count[kvValue.Key] = parsed.GCAttempts
			continue
		}

		parsed.GCAttempts += 1
		toUpdate[kvValue.Key] = parsed
		count[parsed.GUID] = parsed.GCAttempts
	}

	if len(toUpdate) > 0 {
		ops := make([]kv.BatchOp, 0, len(toUpdate))
		for key, metadata := range toUpdate {
			value, err := json.Marshal(metadata)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal gc metadata: %w", err)
			}
			ops = append(ops, kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   key,
				Value: value,
			})
		}
		// Will fail if a secure value has been deleted in the meantime
		if err := s.kv.Batch(ctx, kvSectionSecureValues, ops); err != nil {
			return nil, fmt.Errorf("batch updating secure values: %w", err)
		}
	}

	return count, nil
}

// Parses secure value and closes the reader.
func parseSecureValue(reader io.ReadCloser) (secureValueKV, error) {
	defer func() {
		_ = reader.Close()
	}()

	data, err := io.ReadAll(reader)
	if err != nil {
		return secureValueKV{}, fmt.Errorf("failed to read value: %w", err)
	}

	var value secureValueKV

	if err := json.Unmarshal(data, &value); err != nil {
		return secureValueKV{}, fmt.Errorf("failed to unmarshal value: %w", err)
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

	prefix := makeNamespacePrefix(namespace.String())

	type entry struct {
		key string
		sv  *secureValueKV
	}
	toUpdate := make([]entry, 0)

	for key, err := range s.kv.Keys(ctx, kvSectionSecureValues, resource.ListOptions{
		StartKey: prefix,
		EndKey:   resource.PrefixRangeEnd(prefix),
		Sort:     resource.SortOrderDesc,
	}) {
		if err != nil {
			return fmt.Errorf("listings kv store keys: %+w", err)
		}

		value, err := s.readValue(ctx, key)
		if err != nil {
			return fmt.Errorf("reading secure value from kv store: %w", err)
		}

		if value.OwnerReferenceAPIGroup == apiGroup {
			value.Active = false
			toUpdate = append(toUpdate, entry{key: key, sv: value})
		}
	}

	if len(toUpdate) > 0 {
		ops := make([]kv.BatchOp, 0, len(toUpdate))
		for _, entry := range toUpdate {
			value, err := json.Marshal(entry.sv)
			if err != nil {
				return fmt.Errorf("json marshaling secure value: %w", err)
			}
			ops = append(ops, kv.BatchOp{
				Mode:  kv.BatchOpUpdate,
				Key:   entry.key,
				Value: value,
			})
		}
		if err := s.kv.Batch(ctx, kvSectionSecureValues, ops); err != nil {
			return fmt.Errorf("batch updating secure values: %w", err)
		}
	}

	return nil
}

func makeKey(namespace, name string, version int64) string {
	return fmt.Sprintf("%s/%s/%d", namespace, name, version)
}
