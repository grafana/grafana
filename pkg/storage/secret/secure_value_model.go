package secret

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type secureValueDB struct {
	// Kubernetes Metadata
	GUID        string `xorm:"pk 'guid'"`
	Name        string `xorm:"name"`
	Namespace   string `xorm:"namespace"`
	Annotations string `xorm:"annotations"`
	Labels      string `xorm:"labels"`
	Created     int64  `xorm:"created"`
	CreatedBy   string `xorm:"created_by"`
	Updated     int64  `xorm:"updated"`
	UpdatedBy   string `xorm:"updated_by"`

	// Spec
	Title      string `xorm:"title"`
	Keeper     string `xorm:"keeper"`
	Audiences  string `xorm:"audiences"`
	ExternalID string `xorm:"external_id"`
}

func (*secureValueDB) TableName() string {
	return TableNameSecureValue
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

	audiences := make([]string, 0)
	if sv.Audiences != "" {
		if err := json.Unmarshal([]byte(sv.Audiences), &audiences); err != nil {
			return nil, fmt.Errorf("failed to unmarshal audiences: %w", err)
		}
	}

	resource := &secretv0alpha1.SecureValue{
		Spec: secretv0alpha1.SecureValueSpec{
			Title:     sv.Title,
			Keeper:    sv.Keeper,
			Audiences: audiences,
		},
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

	var audiences string
	if len(sv.Spec.Audiences) > 0 {
		encodedAudiences, err := json.Marshal(sv.Spec.Audiences)
		if err != nil {
			return nil, fmt.Errorf("failed to encode audiences: %w", err)
		}

		audiences = string(encodedAudiences)
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

		Title:      sv.Spec.Title,
		Keeper:     sv.Spec.Keeper,
		Audiences:  audiences,
		ExternalID: externalID,
	}, nil
}
