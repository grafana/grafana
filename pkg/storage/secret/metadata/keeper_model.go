package metadata

import (
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

type keeperDB struct {
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

	// Spec
	Title   string               `xorm:"title"`
	Type    contracts.KeeperType `xorm:"type"`
	Payload string               `xorm:"payload"`
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
			Title: kp.Title,
		},
	}

	// Obtain provider configs
	provider := toProvider(kp.Type, kp.Payload)
	switch v := provider.(type) {
	case *secretv0alpha1.SQLKeeperConfig:
		resource.Spec.SQL = v
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

	now := time.Now().UTC().UnixMilli()

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

	now := time.Now().UTC().UnixMilli()

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
		Created:     meta.GetCreationTimestamp().UnixMilli(),
		CreatedBy:   meta.GetCreatedBy(),
		Updated:     updatedTimestamp,
		UpdatedBy:   meta.GetUpdatedBy(),

		// Spec
		Title:   kp.Spec.Title,
		Type:    keeperType,
		Payload: keeperPayload,
	}, nil
}

// toTypeAndPayload obtain keeper type and payload from a Kubernetes Keeper resource.
func toTypeAndPayload(kp *secretv0alpha1.Keeper) (contracts.KeeperType, string, error) {
	var keeperType contracts.KeeperType
	var keeperPayload string

	if kp.Spec.SQL != nil {
		keeperType = contracts.SQLKeeperType
		jsonData, err := json.Marshal(kp.Spec.SQL)
		if err != nil {
			return "", "", fmt.Errorf("error encoding to json: %w", err)
		}
		keeperPayload = string(jsonData)
	} else if kp.Spec.AWS != nil {
		keeperType = contracts.AWSKeeperType
		jsonData, err := json.Marshal(kp.Spec.AWS.AWSCredentials)
		if err != nil {
			return "", "", fmt.Errorf("error encoding to json: %w", err)
		}
		keeperPayload = string(jsonData)
	} else if kp.Spec.Azure != nil {
		keeperType = contracts.AzureKeeperType
		jsonData, err := json.Marshal(kp.Spec.Azure)
		if err != nil {
			return "", "", fmt.Errorf("error encoding to json: %w", err)
		}
		keeperPayload = string(jsonData)
	} else if kp.Spec.GCP != nil {
		keeperType = contracts.GCPKeeperType
		jsonData, err := json.Marshal(kp.Spec.GCP)
		if err != nil {
			return "", "", fmt.Errorf("error encoding to json: %w", err)
		}
		keeperPayload = string(jsonData)
	} else if kp.Spec.HashiCorp != nil {
		keeperType = contracts.HashiCorpKeeperType
		jsonData, err := json.Marshal(kp.Spec.HashiCorp)
		if err != nil {
			return "", "", fmt.Errorf("error encoding to json: %w", err)
		}
		keeperPayload = string(jsonData)
	}

	return keeperType, keeperPayload, nil
}

// toProvider maps a KeeperType and payload into a provider config struct.
func toProvider(keeperType contracts.KeeperType, payload string) secretv0alpha1.KeeperConfig {
	switch keeperType {
	case contracts.SQLKeeperType:
		sql := &secretv0alpha1.SQLKeeperConfig{}
		if err := json.Unmarshal([]byte(payload), sql); err != nil {
			return nil
		}
		return sql
	case contracts.AWSKeeperType:
		aws := &secretv0alpha1.AWSKeeperConfig{}
		if err := json.Unmarshal([]byte(payload), aws); err != nil {
			return nil
		}
		return aws
	case contracts.AzureKeeperType:
		azure := &secretv0alpha1.AzureKeeperConfig{}
		if err := json.Unmarshal([]byte(payload), azure); err != nil {
			return nil
		}
		return azure
	case contracts.GCPKeeperType:
		gcp := &secretv0alpha1.GCPKeeperConfig{}
		if err := json.Unmarshal([]byte(payload), gcp); err != nil {
			return nil
		}
		return gcp
	case contracts.HashiCorpKeeperType:
		hashicorp := &secretv0alpha1.HashiCorpKeeperConfig{}
		if err := json.Unmarshal([]byte(payload), hashicorp); err != nil {
			return nil
		}
		return hashicorp
	default:
		return nil
	}
}

// extractSecureValues extracts securevalues referenced by the keeper, if any.
func extractSecureValues(kp *secretv0alpha1.Keeper) []string {
	secureValuesFromAWS := func(aws secretv0alpha1.AWSCredentials) []string {
		secureValues := make([]string, 0)

		if aws.AccessKeyID.SecureValueName != "" {
			secureValues = append(secureValues, aws.AccessKeyID.SecureValueName)
		}

		if aws.SecretAccessKey.SecureValueName != "" {
			secureValues = append(secureValues, aws.SecretAccessKey.SecureValueName)
		}

		return secureValues
	}

	secureValuesFromAzure := func(azure secretv0alpha1.AzureCredentials) []string {
		if azure.ClientSecret.SecureValueName != "" {
			return []string{azure.ClientSecret.SecureValueName}
		}

		return nil
	}

	secureValuesFromHashiCorp := func(hashicorp secretv0alpha1.HashiCorpCredentials) []string {
		if hashicorp.Token.SecureValueName != "" {
			return []string{hashicorp.Token.SecureValueName}
		}

		return nil
	}

	switch {
	case kp.Spec.SQL != nil && kp.Spec.SQL.Encryption != nil:
		enc := kp.Spec.SQL.Encryption

		switch {
		case enc.AWS != nil:
			return secureValuesFromAWS(*enc.AWS)

		case enc.Azure != nil:
			return secureValuesFromAzure(*enc.Azure)

		// GCP does not reference secureValues.
		case enc.GCP != nil:
			return nil

		case enc.HashiCorp != nil:
			return secureValuesFromHashiCorp(*enc.HashiCorp)
		}

		return nil

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
