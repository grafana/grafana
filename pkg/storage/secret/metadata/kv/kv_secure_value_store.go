package kv

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// kvSection is the KV store section for secure value metadata
const kvSection = "secret/securevalues"

type secureValueMetadataStorage struct {
	kv    resource.KV
	clock contracts.Clock
}

func NewSecureValueMetadataStorage(kv resource.KV, clock contracts.Clock) contracts.SecureValueMetadataStorage {
	return &secureValueMetadataStorage{
		kv:    kv,
		clock: clock,
	}
}

var _ contracts.SecureValueMetadataStorage = (*secureValueMetadataStorage)(nil)

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

	// Lease fields
	LeaseToken   string `json:"lease_token,omitempty"`
	LeaseCreated int64  `json:"lease_created,omitempty"`
}

// makeKey creates a KV key for a secure value
func makeKey(namespace, name string, version int64) string {
	return fmt.Sprintf("%s/%s/%d", namespace, name, version)
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
		return nil, fmt.Errorf("only one owner reference is supported, found %d", len(ownerReferences))
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
func (s *secureValueMetadataStorage) readValue(ctx context.Context, key string) (*secureValueKV, error) {
	reader, err := s.kv.Get(ctx, kvSection, key)
	if err != nil {
		if errors.Is(err, resource.ErrNotFound) {
			return nil, contracts.ErrSecureValueNotFound
		}

		return nil, fmt.Errorf("failed to get value: %w", err)
	}

	defer func() {
		_ = reader.Close()
	}()

	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read value: %w", err)
	}

	var value secureValueKV

	if err := json.Unmarshal(data, &value); err != nil {
		return nil, fmt.Errorf("failed to unmarshal value: %w", err)
	}

	return &value, nil
}

// writeValue marshals and writes a secure value to KV store
func (s *secureValueMetadataStorage) writeValue(ctx context.Context, key string, value *secureValueKV) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	writer, err := s.kv.Save(ctx, kvSection, key)
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

func (s *secureValueMetadataStorage) getLatestVersion(ctx context.Context, namespace, name string) (latestVersion int64, createdAt int64, err error) {
	prefix := makePrefix(namespace, name)

	for key, err := range s.kv.Keys(ctx, kvSection, resource.ListOptions{
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

	return latestVersion, createdAt, nil
}

func (s *secureValueMetadataStorage) Create(ctx context.Context, keeper string, sv *v1beta1.SecureValue, actorUID string) (*v1beta1.SecureValue, error) {
	latestVersion, createdAt, err := s.getLatestVersion(ctx, sv.Namespace, sv.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest version: %w", err)
	}

	newVersion := latestVersion + 1
	sv.Status.Version = newVersion

	// now, err := s.kv.UnixTimestamp(ctx)
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to get unix timestamp: %w", err)
	// }
	now := s.clock.Now().UTC().Unix()

	// Preserve creation time if this is an update
	if createdAt == 0 {
		createdAt = now
	}

	value, err := fromKubernetes(createdAt, now, keeper, sv, actorUID, "")
	if err != nil {
		return nil, fmt.Errorf("failed to convert to KV format: %w", err)
	}

	// Generate UUID if not set
	if value.GUID == "" {
		value.GUID = uuid.New().String()
	}

	// Save the new version (it starts as inactive)
	key := makeKey(sv.Namespace, sv.Name, newVersion)

	if err := s.writeValue(ctx, key, value); err != nil {
		return nil, fmt.Errorf("failed to write value: %w", err)
	}

	return value.toKubernetes()
}

func (s *secureValueMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string, version int64) error {
	key := makeKey(namespace.String(), name, version)

	if _, err := s.readValue(ctx, key); err != nil && !errors.Is(err, contracts.ErrSecureValueNotFound) {
		return err
	}

	if err := s.kv.Delete(ctx, kvSection, key); err != nil && !errors.Is(err, resource.ErrNotFound) {
		return fmt.Errorf("failed to delete value: %w", err)
	}

	return nil
}

func (s *secureValueMetadataStorage) LeaseInactiveSecureValues(ctx context.Context, maxBatchSize uint16) ([]v1beta1.SecureValue, error) {
	const (
		minAge   = 300 * time.Second // 5 minutes
		leaseTTL = 30 * time.Second  // 30 seconds
	)

	leaseToken := uuid.NewString()

	//now, err := s.kv.UnixTimestamp(ctx)
	//if err != nil {
	//	return nil, fmt.Errorf("failed to get unix timestamp: %w", err)
	//}
	now := s.clock.Now().UTC().Unix()

	// First, collect all eligible items with their keys
	type eligibleItem struct {
		key   string
		value *secureValueKV
	}
	eligible := make([]eligibleItem, 0)

	// List all keys in the store
	for key, err := range s.kv.Keys(ctx, kvSection, resource.ListOptions{}) {
		if err != nil {
			return nil, err
		}

		value, err := s.readValue(ctx, key)
		if err != nil {
			return nil, err
		}

		// Check if this value is eligible for leasing
		ageSeconds := now - value.Created
		leaseAgeSeconds := now - value.LeaseCreated

		if !value.Active && ageSeconds > int64(minAge.Seconds()) && leaseAgeSeconds > int64(leaseTTL.Seconds()) {
			eligible = append(eligible, eligibleItem{
				key:   key,
				value: value,
			})
		}
	}

	// Sort by created time ascending, then by GUID for deterministic ordering
	// (matching SQL ORDER BY created ASC with ties broken by GUID)
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

	result := make([]v1beta1.SecureValue, 0, min(int(maxBatchSize), len(eligible)))

	for i := 0; i < len(eligible) && i < int(maxBatchSize); i++ {
		item := eligible[i]

		// Acquire the lease
		item.value.LeaseToken = leaseToken
		item.value.LeaseCreated = now

		if err := s.writeValue(ctx, item.key, item.value); err != nil {
			return nil, fmt.Errorf("failed to update lease: %w", err)
		}

		sv, err := item.value.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("failed to convert to Kubernetes format: %w", err)
		}

		result = append(result, *sv)
	}

	return result, nil
}

func (s *secureValueMetadataStorage) List(ctx context.Context, namespace xkube.Namespace) ([]v1beta1.SecureValue, error) {
	prefix := makeNamespacePrefix(namespace.String())
	result := make([]v1beta1.SecureValue, 0)

	seen := make(map[string]struct{}, 0)

	for key, err := range s.kv.Keys(ctx, kvSection, resource.ListOptions{
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

func (s *secureValueMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (*v1beta1.SecureValue, error) {
	prefix := makePrefix(namespace.String(), name)

	// List all versions in descending order to find the active one, which might not be the latest inserted
	for key, err := range s.kv.Keys(ctx, kvSection, resource.ListOptions{
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

func (s *secureValueMetadataStorage) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, version int64, externalID contracts.ExternalID) error {
	key := makeKey(namespace.String(), name, version)

	value, err := s.readValue(ctx, key)
	if err != nil {
		return err
	}

	value.ExternalID = externalID.String()

	return s.writeValue(ctx, key, value)
}

func (s *secureValueMetadataStorage) SetVersionToActive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error {
	prefix := makePrefix(namespace.String(), name)
	targetKey := makeKey(namespace.String(), name, version)

	// First, deactivate all versions, this mimics the SQL behavior which happens in a single update query
	for key, err := range s.kv.Keys(ctx, kvSection, resource.ListOptions{
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

func (s *secureValueMetadataStorage) SetVersionToInactive(ctx context.Context, namespace xkube.Namespace, name string, version int64) error {
	key := makeKey(namespace.String(), name, version)

	value, err := s.readValue(ctx, key)
	if err != nil {
		return err
	}

	value.Active = false

	return s.writeValue(ctx, key, value)
}
