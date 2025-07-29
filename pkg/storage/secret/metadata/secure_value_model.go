package metadata

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type secureValueDB struct {
	// Kubernetes Metadata
	GUID                     string
	Name                     string
	Namespace                string
	Annotations              string // map[string]string
	Labels                   string // map[string]string
	Created                  int64
	CreatedBy                string
	Updated                  int64
	UpdatedBy                string
	OwnerReferenceAPIVersion sql.NullString
	OwnerReferenceKind       sql.NullString
	OwnerReferenceName       sql.NullString
	OwnerReferenceUID        sql.NullString

	// Kubernetes Status
	Active  bool
	Version int64

	// Spec
	Description string
	Keeper      sql.NullString
	Decrypters  sql.NullString
	Ref         sql.NullString
	ExternalID  string
}

// toKubernetes maps a DB row into a Kubernetes resource (metadata + spec).
func (sv *secureValueDB) toKubernetes() (*secretv1beta1.SecureValue, error) {
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

	resource := &secretv1beta1.SecureValue{
		Spec: secretv1beta1.SecureValueSpec{
			Description: sv.Description,
			Decrypters:  decrypters,
		},
		Status: secretv1beta1.SecureValueStatus{
			ExternalID: sv.ExternalID,
			Version:    sv.Version,
		},
	}

	if sv.Keeper.Valid {
		resource.Spec.Keeper = &sv.Keeper.String
	}
	if sv.Ref.Valid {
		resource.Spec.Ref = &sv.Ref.String
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

	hasOwnerReference := sv.OwnerReferenceAPIVersion.Valid && sv.OwnerReferenceAPIVersion.String != "" &&
		sv.OwnerReferenceKind.Valid && sv.OwnerReferenceKind.String != "" &&
		sv.OwnerReferenceName.Valid && sv.OwnerReferenceName.String != "" &&
		sv.OwnerReferenceUID.Valid && sv.OwnerReferenceUID.String != ""
	if hasOwnerReference {
		meta.SetOwnerReferences([]metav1.OwnerReference{
			{
				APIVersion: sv.OwnerReferenceAPIVersion.String,
				Kind:       sv.OwnerReferenceKind.String,
				Name:       sv.OwnerReferenceName.String,
				UID:        types.UID(sv.OwnerReferenceUID.String),
			},
		})
	}

	return resource, nil
}

// toCreateRow maps a Kubernetes resource into a DB row for new resources being created/inserted.
func toCreateRow(sv *secretv1beta1.SecureValue, actorUID string) (*secureValueDB, error) {
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

// toRow maps a Kubernetes resource into a DB row.
func toRow(sv *secretv1beta1.SecureValue, externalID string) (*secureValueDB, error) {
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

	var (
		ownerReferenceAPIVersion sql.NullString
		ownerReferenceKind       sql.NullString
		ownerReferenceName       sql.NullString
		ownerReferenceUID        sql.NullString
	)

	ownerReferences := meta.GetOwnerReferences()
	if len(ownerReferences) > 1 {
		return nil, fmt.Errorf("only one owner reference is supported, found %d", len(ownerReferences))
	}
	if len(ownerReferences) == 1 {
		ownerReference := ownerReferences[0]
		ownerReferenceAPIVersion = sql.NullString{String: ownerReference.APIVersion, Valid: true}
		ownerReferenceKind = sql.NullString{String: ownerReference.Kind, Valid: true}
		ownerReferenceName = sql.NullString{String: ownerReference.Name, Valid: true}
		ownerReferenceUID = sql.NullString{String: string(ownerReference.UID), Valid: true}
	}

	return &secureValueDB{
		GUID:                     string(sv.UID),
		Name:                     sv.Name,
		Namespace:                sv.Namespace,
		Annotations:              annotations,
		Labels:                   labels,
		Created:                  meta.GetCreationTimestamp().UnixMilli(),
		CreatedBy:                meta.GetCreatedBy(),
		Updated:                  updatedTimestamp,
		UpdatedBy:                meta.GetUpdatedBy(),
		OwnerReferenceAPIVersion: ownerReferenceAPIVersion,
		OwnerReferenceKind:       ownerReferenceKind,
		OwnerReferenceName:       ownerReferenceName,
		OwnerReferenceUID:        ownerReferenceUID,

		Version: sv.Status.Version,

		Description: sv.Spec.Description,
		Keeper:      toNullString(sv.Spec.Keeper),
		Decrypters:  toNullString(decrypters),
		Ref:         toNullString(sv.Spec.Ref),
		ExternalID:  externalID,
	}, nil
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
