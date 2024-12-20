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

type KeeperType string

const (
	SqlKeeperType       KeeperType = "sql"
	AWSKeeperType       KeeperType = "aws"
	AzureKeeperType     KeeperType = "azure"
	GCPKeeperType       KeeperType = "gcp"
	HashiCorpKeeperType KeeperType = "hashicorp"
)

type Keeper struct {
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
	Title   string     `xorm:"title"`
	Type    KeeperType `xorm:"type"`
	Payload string     `xorm:"payload"`
}

func (*Keeper) TableName() string {
	return TableNameKeeper
}

// toKubernetes maps a DB row into a Kubernetes resource (metadata + spec).
func (kp *Keeper) toKubernetes() (*secretv0alpha1.Keeper, error) {
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
	case *secretv0alpha1.SQLKeeper:
		resource.Spec.SQL = v
	case *secretv0alpha1.AWSKeeper:
		resource.Spec.AWS = v
	case *secretv0alpha1.AzureKeeper:
		resource.Spec.Azure = v
	case *secretv0alpha1.GCPKeeper:
		resource.Spec.GCP = v
	case *secretv0alpha1.HashiCorpKeeper:
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
func toKeeperCreateRow(kp *secretv0alpha1.Keeper, actorUID string) (*Keeper, error) {
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
func toKeeperUpdateRow(currentRow *Keeper, newKeeper *secretv0alpha1.Keeper, actorUID string) (*Keeper, error) {
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
func toKeeperRow(kp *secretv0alpha1.Keeper) (*Keeper, error) {
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

	return &Keeper{
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
func toTypeAndPayload(kp *secretv0alpha1.Keeper) (KeeperType, string, error) {
	var keeperType KeeperType
	var keeperPayload string

	if kp.Spec.SQL != nil {
		keeperType = SqlKeeperType
		jsonData, err := json.Marshal(kp.Spec.SQL)
		if err != nil {
			return "", "", fmt.Errorf("error encoding to json: %w", err)
		}
		keeperPayload = string(jsonData)
	} else if kp.Spec.AWS != nil {
		keeperType = AWSKeeperType
		jsonData, err := json.Marshal(kp.Spec.AWS.AWSCredentials)
		if err != nil {
			return "", "", fmt.Errorf("error encoding to json: %w", err)
		}
		keeperPayload = string(jsonData)
	} else if kp.Spec.Azure != nil {
		keeperType = AzureKeeperType
		jsonData, err := json.Marshal(kp.Spec.Azure)
		if err != nil {
			return "", "", fmt.Errorf("error encoding to json: %w", err)
		}
		keeperPayload = string(jsonData)
	} else if kp.Spec.GCP != nil {
		keeperType = GCPKeeperType
		jsonData, err := json.Marshal(kp.Spec.GCP)
		if err != nil {
			return "", "", fmt.Errorf("error encoding to json: %w", err)
		}
		keeperPayload = string(jsonData)
	} else if kp.Spec.HashiCorp != nil {
		keeperType = HashiCorpKeeperType
		jsonData, err := json.Marshal(kp.Spec.HashiCorp)
		if err != nil {
			return "", "", fmt.Errorf("error encoding to json: %w", err)
		}
		keeperPayload = string(jsonData)
	}

	return keeperType, keeperPayload, nil
}

// toProvider maps a KeeperType and payload into a provider config struct.
func toProvider(keeperType KeeperType, payload string) interface{} {
	switch keeperType {
	case SqlKeeperType:
		sql := &secretv0alpha1.SQLKeeper{}
		if err := json.Unmarshal([]byte(payload), sql); err != nil {
			return nil
		}
		return sql
	case AWSKeeperType:
		aws := &secretv0alpha1.AWSKeeper{}
		if err := json.Unmarshal([]byte(payload), aws); err != nil {
			return nil
		}
		return aws
	case AzureKeeperType:
		azure := &secretv0alpha1.AzureKeeper{}
		if err := json.Unmarshal([]byte(payload), azure); err != nil {
			return nil
		}
		return azure
	case GCPKeeperType:
		gcp := &secretv0alpha1.GCPKeeper{}
		if err := json.Unmarshal([]byte(payload), gcp); err != nil {
			return nil
		}
		return gcp
	case HashiCorpKeeperType:
		hashicorp := &secretv0alpha1.HashiCorpKeeper{}
		if err := json.Unmarshal([]byte(payload), hashicorp); err != nil {
			return nil
		}
		return hashicorp
	default:
		return nil
	}
}
