package metadata

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type secureValueDB struct {
	// Kubernetes Metadata
	GUID        string `xorm:"pk 'guid'"`
	Name        string `xorm:"name"`
	Namespace   string `xorm:"namespace"`
	Annotations string `xorm:"annotations"` // map[string]string
	Labels      string `xorm:"labels"`      // map[string]string
	Created     int64  `xorm:"created"`
	CreatedBy   string `xorm:"created_by"`
	Updated     int64  `xorm:"updated"`
	UpdatedBy   string `xorm:"updated_by"`

	// Kubernetes Status
	Phase   string  `xorm:"status_phase"`
	Message *string `xorm:"status_message"`

	// Spec
	Title      string  `xorm:"title"`
	Keeper     string  `xorm:"keeper"`
	Decrypters *string `xorm:"decrypters"`
	Ref        *string `xorm:"ref"`
	ExternalID string  `xorm:"external_id"`
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
	if sv.Decrypters != nil && *sv.Decrypters != "" {
		if err := json.Unmarshal([]byte(*sv.Decrypters), &decrypters); err != nil {
			return nil, fmt.Errorf("failed to unmarshal decrypters: %w", err)
		}
	}

	resource := &secretv0alpha1.SecureValue{
		Spec: secretv0alpha1.SecureValueSpec{
			Title:      sv.Title,
			Keeper:     sv.Keeper,
			Decrypters: decrypters,
		},
		Status: secretv0alpha1.SecureValueStatus{
			Phase: secretv0alpha1.SecureValuePhase(sv.Phase),
		},
	}
	if sv.Ref != nil {
		resource.Spec.Ref = *sv.Ref
	}
	if sv.Message != nil && *sv.Message != "" {
		resource.Status.Message = *sv.Message
	}

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
func toCreateRow(sv *secretv0alpha1.SecureValue, actorUID, externalID string) (*secureValueDB, error) {
	row, err := toRow(sv, externalID)
	if err != nil {
		return nil, fmt.Errorf("failed to create: %w", err)
	}

	now := time.Now().UTC().UnixMilli()

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

	now := time.Now().UTC().UnixMilli()

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

	var ref *string
	if sv.Spec.Ref != "" {
		ref = &sv.Spec.Ref
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
		Message: statusMessage,

		Title:      sv.Spec.Title,
		Keeper:     sv.Spec.Keeper,
		Decrypters: decrypters,
		Ref:        ref,
		ExternalID: externalID,
	}, nil
}
