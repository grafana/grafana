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

type keeperDB struct {
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

	// Spec
	Description string
	Type        string
	Payload     string
}

func (*keeperDB) TableName() string {
	return migrator.TableNameKeeper
}

// toKubernetes maps a DB row into a Kubernetes resource (metadata + spec).
func (kp *keeperDB) toKubernetes() (*secretv0alpha1.Keeper, error) {
	annotations := make(map[string]string, 0)
	if kp.Annotations != "" {
		if err := json.Unmarshal([]byte(kp.Annotations), &annotations); err != nil {
			return nil, fmt.Errorf("failed to unmarshal annotations: %w", err)
		}
	}

	labels := make(map[string]string, 0)
	if kp.Labels != "" {
		if err := json.Unmarshal([]byte(kp.Labels), &labels); err != nil {
			return nil, fmt.Errorf("failed to unmarshal labels: %w", err)
		}
	}

	resource := &secretv0alpha1.Keeper{
		Spec: secretv0alpha1.KeeperSpec{
			Description: kp.Description,
		},
	}

	// Obtain provider configs
	provider := toProvider(secretv0alpha1.KeeperType(kp.Type), kp.Payload)
	switch v := provider.(type) {
	case *secretv0alpha1.AWSKeeperConfig:
		resource.Spec.AWS = v
	case *secretv0alpha1.AzureKeeperConfig:
		resource.Spec.Azure = v
	case *secretv0alpha1.GCPKeeperConfig:
		resource.Spec.GCP = v
	case *secretv0alpha1.HashiCorpKeeperConfig:
		resource.Spec.HashiCorp = v
	}

	// Set all meta fields here for consistency.
	meta, err := utils.MetaAccessor(resource)
	if err != nil {
		return nil, fmt.Errorf("failed to get meta accessor: %w", err)
	}

	updated := time.Unix(kp.Updated, 0).UTC()

	meta.SetUID(types.UID(kp.GUID))
	meta.SetName(kp.Name)
	meta.SetNamespace(kp.Namespace)
	meta.SetAnnotations(annotations)
	meta.SetLabels(labels)
	meta.SetCreatedBy(kp.CreatedBy)
	meta.SetCreationTimestamp(metav1.NewTime(time.Unix(kp.Created, 0).UTC()))
	meta.SetUpdatedBy(kp.UpdatedBy)
	meta.SetUpdatedTimestamp(&updated)
	meta.SetResourceVersionInt64(kp.Updated)

	return resource, nil
}

// toKeeperCreateRow maps a Kubernetes resource into a DB row for new resources being created/inserted.
func toKeeperCreateRow(kp *secretv0alpha1.Keeper, actorUID string) (*keeperDB, error) {
	row, err := toKeeperRow(kp)
	if err != nil {
		return nil, fmt.Errorf("failed to map to row: %w", err)
	}

	now := time.Now().UTC().Unix()

	row.GUID = uuid.New().String()
	row.Created = now
	row.CreatedBy = actorUID
	row.Updated = now
	row.UpdatedBy = actorUID

	return row, nil
}

// toKeeperUpdateRow maps a Kubernetes resource into a DB row for existing resources being updated.
func toKeeperUpdateRow(currentRow *keeperDB, newKeeper *secretv0alpha1.Keeper, actorUID string) (*keeperDB, error) {
	row, err := toKeeperRow(newKeeper)
	if err != nil {
		return nil, fmt.Errorf("failed to map to row: %w", err)
	}

	now := time.Now().UTC().Unix()

	row.GUID = currentRow.GUID
	row.Created = currentRow.Created
	row.CreatedBy = currentRow.CreatedBy
	row.Updated = now
	row.UpdatedBy = actorUID

	return row, nil
}

// toKeeperRow maps a Kubernetes Keeper resource into a Keeper DB row.
func toKeeperRow(kp *secretv0alpha1.Keeper) (*keeperDB, error) {
	var annotations string
	if len(kp.Annotations) > 0 {
		cleanedAnnotations := xkube.CleanAnnotations(kp.Annotations)
		if len(cleanedAnnotations) > 0 {
			kp.Annotations = make(map[string]string) // Safety: reset to prohibit use of kp.Annotations further.

			encodedAnnotations, err := json.Marshal(cleanedAnnotations)
			if err != nil {
				return nil, fmt.Errorf("failed to encode annotations: %w", err)
			}

			annotations = string(encodedAnnotations)
		}
	}

	var labels string
	if len(kp.Labels) > 0 {
		encodedLabels, err := json.Marshal(kp.Labels)
		if err != nil {
			return nil, fmt.Errorf("failed to encode labels: %w", err)
		}

		labels = string(encodedLabels)
	}

	meta, err := utils.MetaAccessor(kp)
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

	keeperType, keeperPayload, err := toTypeAndPayload(kp)
	if err != nil {
		return nil, fmt.Errorf("failed to obtain type and payload: %w", err)
	}

	return &keeperDB{
		// Kubernetes Metadata
		GUID:        string(kp.UID),
		Name:        kp.Name,
		Namespace:   kp.Namespace,
		Annotations: annotations,
		Labels:      labels,
		Created:     meta.GetCreationTimestamp().Unix(),
		CreatedBy:   meta.GetCreatedBy(),
		Updated:     updatedTimestamp,
		UpdatedBy:   meta.GetUpdatedBy(),

		// Spec
		Description: kp.Spec.Description,
		Type:        keeperType.String(),
		Payload:     keeperPayload,
	}, nil
}

// toTypeAndPayload obtain keeper type and payload from a Kubernetes Keeper resource.
// TODO: Move as method of KeeperSpec
func toTypeAndPayload(kp *secretv0alpha1.Keeper) (secretv0alpha1.KeeperType, string, error) {
	if kp.Spec.AWS != nil {
		payload, err := json.Marshal(kp.Spec.AWS.AWSCredentials)
		return secretv0alpha1.AWSKeeperType, string(payload), err
	} else if kp.Spec.Azure != nil {
		payload, err := json.Marshal(kp.Spec.Azure)
		return secretv0alpha1.AzureKeeperType, string(payload), err
	} else if kp.Spec.GCP != nil {
		payload, err := json.Marshal(kp.Spec.GCP)
		return secretv0alpha1.GCPKeeperType, string(payload), err
	} else if kp.Spec.HashiCorp != nil {
		payload, err := json.Marshal(kp.Spec.HashiCorp)
		return secretv0alpha1.HashiCorpKeeperType, string(payload), err
	}

	return "", "", fmt.Errorf("no keeper type found")
}

// toProvider maps a KeeperType and payload into a provider config struct.
// TODO: Move as method of KeeperType
func toProvider(keeperType secretv0alpha1.KeeperType, payload string) secretv0alpha1.KeeperConfig {
	switch keeperType {
	case secretv0alpha1.AWSKeeperType:
		aws := &secretv0alpha1.AWSKeeperConfig{}
		if err := json.Unmarshal([]byte(payload), aws); err != nil {
			return nil
		}
		return aws
	case secretv0alpha1.AzureKeeperType:
		azure := &secretv0alpha1.AzureKeeperConfig{}
		if err := json.Unmarshal([]byte(payload), azure); err != nil {
			return nil
		}
		return azure
	case secretv0alpha1.GCPKeeperType:
		gcp := &secretv0alpha1.GCPKeeperConfig{}
		if err := json.Unmarshal([]byte(payload), gcp); err != nil {
			return nil
		}
		return gcp
	case secretv0alpha1.HashiCorpKeeperType:
		hashicorp := &secretv0alpha1.HashiCorpKeeperConfig{}
		if err := json.Unmarshal([]byte(payload), hashicorp); err != nil {
			return nil
		}
		return hashicorp
	default:
		return nil
	}
}

// extractSecureValues extracts unique securevalues referenced by the keeper, if any.
func extractSecureValues(kp *secretv0alpha1.Keeper) map[string]struct{} {
	secureValuesFromAWS := func(aws secretv0alpha1.AWSCredentials) map[string]struct{} {
		secureValues := make(map[string]struct{}, 0)

		if aws.AccessKeyID.SecureValueName != "" {
			secureValues[aws.AccessKeyID.SecureValueName] = struct{}{}
		}

		if aws.SecretAccessKey.SecureValueName != "" {
			secureValues[aws.SecretAccessKey.SecureValueName] = struct{}{}
		}

		return secureValues
	}

	secureValuesFromAzure := func(azure secretv0alpha1.AzureCredentials) map[string]struct{} {
		if azure.ClientSecret.SecureValueName != "" {
			return map[string]struct{}{azure.ClientSecret.SecureValueName: {}}
		}

		return nil
	}

	secureValuesFromHashiCorp := func(hashicorp secretv0alpha1.HashiCorpCredentials) map[string]struct{} {
		if hashicorp.Token.SecureValueName != "" {
			return map[string]struct{}{hashicorp.Token.SecureValueName: {}}
		}

		return nil
	}

	switch {
	case kp.Spec.AWS != nil:
		return secureValuesFromAWS(kp.Spec.AWS.AWSCredentials)

	case kp.Spec.Azure != nil:
		return secureValuesFromAzure(kp.Spec.Azure.AzureCredentials)

	// GCP does not reference secureValues.
	case kp.Spec.GCP != nil:
		return nil

	case kp.Spec.HashiCorp != nil:
		return secureValuesFromHashiCorp(kp.Spec.HashiCorp.HashiCorpCredentials)
	}

	return nil
}
