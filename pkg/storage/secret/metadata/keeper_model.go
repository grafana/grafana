package metadata

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
func (kp *keeperDB) toKubernetes() (*secretv1beta1.Keeper, error) {
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

	resource := &secretv1beta1.Keeper{
		Spec: secretv1beta1.KeeperSpec{
			Description: kp.Description,
		},
	}

	// Obtain provider configs
	provider := toProvider(secretv1beta1.KeeperType(kp.Type), kp.Payload)
	switch v := provider.(type) {
	case *secretv1beta1.KeeperAWSConfig:
		resource.Spec.Aws = v
	case *secretv1beta1.KeeperAzureConfig:
		resource.Spec.Azure = v
	case *secretv1beta1.KeeperGCPConfig:
		resource.Spec.Gcp = v
	case *secretv1beta1.KeeperHashiCorpConfig:
		resource.Spec.HashiCorpVault = v
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
func toKeeperCreateRow(kp *secretv1beta1.Keeper, actorUID string) (*keeperDB, error) {
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
func toKeeperUpdateRow(currentRow *keeperDB, newKeeper *secretv1beta1.Keeper, actorUID string) (*keeperDB, error) {
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
func toKeeperRow(kp *secretv1beta1.Keeper) (*keeperDB, error) {
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
func toTypeAndPayload(kp *secretv1beta1.Keeper) (secretv1beta1.KeeperType, string, error) {
	if kp.Spec.Aws != nil {
		payload, err := json.Marshal(kp.Spec.Aws)
		return secretv1beta1.AWSKeeperType, string(payload), err
	} else if kp.Spec.Azure != nil {
		payload, err := json.Marshal(kp.Spec.Azure)
		return secretv1beta1.AzureKeeperType, string(payload), err
	} else if kp.Spec.Gcp != nil {
		payload, err := json.Marshal(kp.Spec.Gcp)
		return secretv1beta1.GCPKeeperType, string(payload), err
	} else if kp.Spec.HashiCorpVault != nil {
		payload, err := json.Marshal(kp.Spec.HashiCorpVault)
		return secretv1beta1.HashiCorpKeeperType, string(payload), err
	}

	return "", "", fmt.Errorf("no keeper type found")
}

// toProvider maps a KeeperType and payload into a provider config struct.
// TODO: Move as method of KeeperType
func toProvider(keeperType secretv1beta1.KeeperType, payload string) secretv1beta1.KeeperConfig {
	switch keeperType {
	case secretv1beta1.AWSKeeperType:
		aws := &secretv1beta1.KeeperAWSConfig{}
		if err := json.Unmarshal([]byte(payload), aws); err != nil {
			return nil
		}
		return aws
	case secretv1beta1.AzureKeeperType:
		azure := &secretv1beta1.KeeperAzureConfig{}
		if err := json.Unmarshal([]byte(payload), azure); err != nil {
			return nil
		}
		return azure
	case secretv1beta1.GCPKeeperType:
		gcp := &secretv1beta1.KeeperGCPConfig{}
		if err := json.Unmarshal([]byte(payload), gcp); err != nil {
			return nil
		}
		return gcp
	case secretv1beta1.HashiCorpKeeperType:
		hashicorp := &secretv1beta1.KeeperHashiCorpConfig{}
		if err := json.Unmarshal([]byte(payload), hashicorp); err != nil {
			return nil
		}
		return hashicorp
	default:
		return nil
	}
}

// extractSecureValues extracts unique securevalues referenced by the keeper, if any.
func extractSecureValues(kp *secretv1beta1.Keeper) map[string]struct{} {
	switch {
	case kp.Spec.Aws != nil:
		secureValues := make(map[string]struct{}, 0)

		if kp.Spec.Aws.AccessKeyID.SecureValueName != "" {
			secureValues[kp.Spec.Aws.AccessKeyID.SecureValueName] = struct{}{}
		}

		if kp.Spec.Aws.SecretAccessKey.SecureValueName != "" {
			secureValues[kp.Spec.Aws.SecretAccessKey.SecureValueName] = struct{}{}
		}

		return secureValues

	case kp.Spec.Azure != nil:
		if kp.Spec.Azure.ClientSecret.SecureValueName != "" {
			return map[string]struct{}{kp.Spec.Azure.ClientSecret.SecureValueName: {}}
		}

	// GCP does not reference secureValues.
	case kp.Spec.Gcp != nil:
		return nil

	case kp.Spec.HashiCorpVault != nil:
		if kp.Spec.HashiCorpVault.Token.SecureValueName != "" {
			return map[string]struct{}{kp.Spec.HashiCorpVault.Token.SecureValueName: {}}
		}
	}

	return nil
}
