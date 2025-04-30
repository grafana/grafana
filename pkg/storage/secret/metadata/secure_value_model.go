package metadata

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type secureValueDB struct {
	// Kubernetes Metadata
	GUID        string
	Name        string
	Namespace   string
	Annotations string // map[string]string
	Labels      string // map[string]string
	Created     int64
	CreatedBy   string
	Updated     int64
	UpdatedBy   string

	// Kubernetes Status
	Phase   string
	Message sql.NullString

	// Spec
	Description string
	Keeper      sql.NullString
	Decrypters  sql.NullString
	Ref         sql.NullString
	ExternalID  string
}

func (*secureValueDB) TableName() string {
	return migrator.TableNameSecureValue
}

// toKubernetes maps a DB row into a Kubernetes resource (metadata + spec).
func (sv *secureValueDB) toKubernetes() (*secretv0alpha1.SecureValue, error) {
	annotations := make(map[string]string, 0)
	if sv.Annotations != "" {
		if err := json.Unmarshal([]byte(sv.Annotations), &annotations); err != nil {
			return nil, fmt.Errorf("failed to unmarshal annotations: %w", err)
		}
	}

	labels := make(map[string]string, 0)
	if sv.Labels != "" {
		if err := json.Unmarshal([]byte(sv.Labels), &labels); err != nil {
			return nil, fmt.Errorf("failed to unmarshal labels: %w", err)
		}
	}

	decrypters := make([]string, 0)

	if sv.Decrypters.Valid && sv.Decrypters.String != "" {
		if err := json.Unmarshal([]byte(sv.Decrypters.String), &decrypters); err != nil {
			return nil, fmt.Errorf("failed to unmarshal decrypters: %w", err)
		}
	}

	resource := &secretv0alpha1.SecureValue{
		Spec: secretv0alpha1.SecureValueSpec{
			Description: sv.Description,
			Decrypters:  decrypters,
		},
		Status: secretv0alpha1.SecureValueStatus{
			Phase:      secretv0alpha1.SecureValuePhase(sv.Phase),
			ExternalID: sv.ExternalID,
		},
	}

	if sv.Keeper.Valid {
		resource.Spec.Keeper = &sv.Keeper.String
	}
	if sv.Ref.Valid {
		resource.Spec.Ref = &sv.Ref.String
	}
	if sv.Message.Valid {
		resource.Status.Message = sv.Message.String
	}
	resource.Status.ExternalID = sv.ExternalID

	// Set all meta fields here for consistency.
	meta, err := utils.MetaAccessor(resource)
	if err != nil {
		return nil, fmt.Errorf("failed to get meta accessor: %w", err)
	}

	updated := time.Unix(sv.Updated, 0).UTC()

	meta.SetUID(types.UID(sv.GUID))
	meta.SetName(sv.Name)
	meta.SetNamespace(sv.Namespace)
	meta.SetAnnotations(annotations)
	meta.SetLabels(labels)
	meta.SetCreatedBy(sv.CreatedBy)
	meta.SetCreationTimestamp(metav1.NewTime(time.Unix(sv.Created, 0).UTC()))
	meta.SetUpdatedBy(sv.UpdatedBy)
	meta.SetUpdatedTimestamp(&updated)
	meta.SetResourceVersionInt64(sv.Updated)

	return resource, nil
}

// toCreateRow maps a Kubernetes resource into a DB row for new resources being created/inserted.
func toCreateRow(sv *secretv0alpha1.SecureValue, actorUID string) (*secureValueDB, error) {
	row, err := toRow(sv, "")
	if err != nil {
		return nil, fmt.Errorf("failed to convert SecureValue to secureValueDB: %w", err)
	}

	now := time.Now().UTC().Unix()

	row.GUID = uuid.New().String()
	row.Created = now
	row.CreatedBy = actorUID
	row.Updated = now
	row.UpdatedBy = actorUID

	return row, nil
}

// toUpdateRow maps a Kubernetes resource into a DB row for existing resources being updated.
func toUpdateRow(currentRow *secureValueDB, newSecureValue *secretv0alpha1.SecureValue, actorUID, externalID string) (*secureValueDB, error) {
	row, err := toRow(newSecureValue, externalID)
	if err != nil {
		return nil, fmt.Errorf("failed to create: %w", err)
	}

	now := time.Now().UTC().Unix()

	row.GUID = currentRow.GUID
	row.Created = currentRow.Created
	row.CreatedBy = currentRow.CreatedBy
	row.Updated = now
	row.UpdatedBy = actorUID

	return row, nil
}

// toRow maps a Kubernetes resource into a DB row.
func toRow(sv *secretv0alpha1.SecureValue, externalID string) (*secureValueDB, error) {
	var annotations string
	if len(sv.Annotations) > 0 {
		cleanedAnnotations := xkube.CleanAnnotations(sv.Annotations)
		if len(cleanedAnnotations) > 0 {
			sv.Annotations = make(map[string]string) // Safety: reset to prohibit use of sv.Annotations further.

			encodedAnnotations, err := json.Marshal(cleanedAnnotations)
			if err != nil {
				return nil, fmt.Errorf("failed to encode annotations: %w", err)
			}

			annotations = string(encodedAnnotations)
		}
	}

	var labels string
	if len(sv.Labels) > 0 {
		encodedLabels, err := json.Marshal(sv.Labels)
		if err != nil {
			return nil, fmt.Errorf("failed to encode labels: %w", err)
		}

		labels = string(encodedLabels)
	}

	var decrypters *string
	if len(sv.Spec.Decrypters) > 0 {
		encodedDecrypters, err := json.Marshal(sv.Spec.Decrypters)
		if err != nil {
			return nil, fmt.Errorf("failed to encode decrypters: %w", err)
		}

		rawDecrypters := string(encodedDecrypters)
		decrypters = &rawDecrypters
	}

	meta, err := utils.MetaAccessor(sv)
	if err != nil {
		return nil, fmt.Errorf("failed to get meta accessor: %w", err)
	}

	if meta.GetFolder() != "" {
		return nil, fmt.Errorf("folders are not supported")
	}

	updatedTimestamp, err := meta.GetResourceVersionInt64()
	if err != nil {
		return nil, fmt.Errorf("failed to get resource version: %w", err)
	}

	var statusMessage *string
	if sv.Status.Message != "" {
		statusMessage = &sv.Status.Message
	}

	return &secureValueDB{
		GUID:        string(sv.UID),
		Name:        sv.Name,
		Namespace:   sv.Namespace,
		Annotations: annotations,
		Labels:      labels,
		Created:     meta.GetCreationTimestamp().UnixMilli(),
		CreatedBy:   meta.GetCreatedBy(),
		Updated:     updatedTimestamp,
		UpdatedBy:   meta.GetUpdatedBy(),

		Phase:   string(sv.Status.Phase),
		Message: toNullString(statusMessage),

		Description: sv.Spec.Description,
		Keeper:      toNullString(sv.Spec.Keeper),
		Decrypters:  toNullString(decrypters),
		Ref:         toNullString(sv.Spec.Ref),
		ExternalID:  externalID,
	}, nil
}

// to Decrypt maps a DB row into a DecryptSecureValue object needed for decryption.
func (sv *secureValueDB) toDecrypt() (*contracts.DecryptSecureValue, error) {
	decrypters := make([]string, 0)
	if sv.Decrypters.Valid && sv.Decrypters.String != "" {
		if err := json.Unmarshal([]byte(sv.Decrypters.String), &decrypters); err != nil {
			return nil, fmt.Errorf("failed to unmarshal decrypters: %w", err)
		}
	}

	decryptSecureValue := &contracts.DecryptSecureValue{
		Decrypters: decrypters,
		ExternalID: sv.ExternalID,
	}

	if sv.Keeper.Valid && sv.Keeper.String != "" {
		decryptSecureValue.Keeper = &sv.Keeper.String
	}
	if sv.Ref.Valid && sv.Ref.String != "" {
		decryptSecureValue.Ref = sv.Ref.String
	}

	return decryptSecureValue, nil
}

// toNullString returns a sql.NullString struct given a *string
// assumes that "" (empty string) is a valid string
func toNullString(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{
			String: "",
			Valid:  false,
		}
	}

	return sql.NullString{
		String: *s,
		Valid:  true,
	}
}
